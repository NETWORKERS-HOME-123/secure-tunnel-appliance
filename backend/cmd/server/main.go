package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/ultraslim/server/internal/api"
	"github.com/ultraslim/server/internal/auth"
	"github.com/ultraslim/server/internal/config"
	"github.com/ultraslim/server/internal/db"
	"github.com/ultraslim/server/internal/middleware"
	"github.com/ultraslim/server/internal/relay"
)

func main() {
	cfg := config.Load()

	// Init auth
	auth.Init(cfg.JWTSecret)

	// Init database
	if err := db.Init(cfg.DatabaseURL); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := db.Migrate(); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Create default superadmin if none exists
	createDefaultSuperadmin()

	// Init relay hub
	hub := relay.NewHub(cfg.TunnelDomain, cfg.TCPPortMin, cfg.TCPPortMax)

	// Build router
	mux := http.NewServeMux()

	// Create rate limiters for different endpoints
	loginLimiter := middleware.RateLimitMiddleware(10.0/60, 5)      // 10 per minute, burst 5
	signupLimiter := middleware.RateLimitMiddleware(5.0/60, 3)      // 5 per minute, burst 3
	pwdLimiter := middleware.RateLimitMiddleware(3.0/3600, 2)       // 3 per hour, burst 2
	agentLimiter := middleware.RateLimitMiddleware(20.0/60, 5)      // 20 per minute, burst 5

	// ── Public routes ────────────────────────────────────
	mux.Handle("POST /api/auth/signup", signupLimiter(http.HandlerFunc(api.HandleSignup)))
	mux.Handle("POST /api/auth/login", loginLimiter(http.HandlerFunc(api.HandleLogin)))
	mux.Handle("POST /api/auth/forgot-password", pwdLimiter(http.HandlerFunc(api.HandleForgotPassword)))
	mux.Handle("POST /api/auth/reset-password", pwdLimiter(http.HandlerFunc(api.HandleResetPassword)))
	mux.HandleFunc("GET /api/health", api.HandleSystemHealth)

	// ── Agent WebSocket ──────────────────────────────────
	mux.Handle("GET /ws/agent", agentLimiter(http.HandlerFunc(hub.HandleAgentConnect)))

	// ── Dashboard WebSocket ──────────────────────────────
	mux.HandleFunc("GET /ws/realtime", hub.HandleDashboardWS)

	// ── Protected routes ─────────────────────────────────
	// Auth
	mux.Handle("POST /api/auth/refresh", middleware.AuthMiddleware(http.HandlerFunc(api.HandleRefreshToken)))

	// Profile
	mux.Handle("GET /api/profile", middleware.AuthMiddleware(http.HandlerFunc(api.HandleGetProfile)))
	mux.Handle("PATCH /api/profile", middleware.AuthMiddleware(http.HandlerFunc(api.HandleUpdateProfile)))

	// Tunnels
	mux.Handle("GET /api/tunnels", middleware.AuthMiddleware(http.HandlerFunc(api.HandleGetTunnels)))
	mux.Handle("DELETE /api/tunnels/{id}", middleware.AuthMiddleware(http.HandlerFunc(api.HandleDeleteTunnel)))

	// API Keys
	mux.Handle("GET /api/api-keys", middleware.AuthMiddleware(http.HandlerFunc(api.HandleGetAPIKeys)))
	mux.Handle("POST /api/api-keys", middleware.AuthMiddleware(http.HandlerFunc(api.HandleCreateAPIKey)))
	mux.Handle("DELETE /api/api-keys/{id}", middleware.AuthMiddleware(http.HandlerFunc(api.HandleDeleteAPIKey)))

	// Webhooks
	mux.Handle("GET /api/webhooks", middleware.AuthMiddleware(http.HandlerFunc(api.HandleGetWebhooks)))
	mux.Handle("POST /api/webhooks", middleware.AuthMiddleware(http.HandlerFunc(api.HandleCreateWebhook)))
	mux.Handle("PATCH /api/webhooks/{id}", middleware.AuthMiddleware(http.HandlerFunc(api.HandleUpdateWebhook)))
	mux.Handle("DELETE /api/webhooks/{id}", middleware.AuthMiddleware(http.HandlerFunc(api.HandleDeleteWebhook)))

	// Notifications
	mux.Handle("GET /api/notifications", middleware.AuthMiddleware(http.HandlerFunc(api.HandleGetNotifications)))
	mux.Handle("PATCH /api/notifications/{id}/read", middleware.AuthMiddleware(http.HandlerFunc(api.HandleMarkNotificationRead)))
	mux.Handle("POST /api/notifications/read-all", middleware.AuthMiddleware(http.HandlerFunc(api.HandleMarkAllNotificationsRead)))
	mux.Handle("DELETE /api/notifications", middleware.AuthMiddleware(http.HandlerFunc(api.HandleDeleteNotifications)))

	// Analytics
	mux.Handle("GET /api/analytics", middleware.AuthMiddleware(http.HandlerFunc(api.HandleGetAnalytics)))
	mux.Handle("GET /api/analytics/connections", middleware.AuthMiddleware(http.HandlerFunc(api.HandleGetConnectionLogs)))

	// Health checks
	mux.Handle("GET /api/tunnels/{id}/health", middleware.AuthMiddleware(http.HandlerFunc(api.HandleTunnelHealthCheck)))

	// Config export
	mux.Handle("GET /api/config/export", middleware.AuthMiddleware(http.HandlerFunc(api.HandleExportConfig)))

	// ── Admin routes (superadmin only) ───────────────────
	mux.Handle("GET /api/admin/users", middleware.AuthMiddleware(middleware.SuperadminMiddleware(http.HandlerFunc(api.HandleAdminGetUsers))))
	mux.Handle("POST /api/admin/roles", middleware.AuthMiddleware(middleware.SuperadminMiddleware(http.HandlerFunc(api.HandleAdminAssignRole))))
	mux.Handle("GET /api/admin/tunnels", middleware.AuthMiddleware(middleware.SuperadminMiddleware(http.HandlerFunc(api.HandleAdminGetAllTunnels))))
	mux.Handle("DELETE /api/admin/tunnels/{id}", middleware.AuthMiddleware(middleware.SuperadminMiddleware(http.HandlerFunc(api.HandleAdminDeleteTunnel))))
	mux.Handle("GET /api/admin/audit-logs", middleware.AuthMiddleware(middleware.SuperadminMiddleware(http.HandlerFunc(api.HandleAdminGetAuditLogs))))

	// ── Static files (React SPA) ─────────────────────────
	spa := spaHandler{staticPath: "./static", indexPath: "index.html"}
	mux.Handle("GET /", spa)

	// Apply global middleware
	handler := middleware.CORSMiddleware(mux)

	// ── Tunnel proxy server (runs on a separate handler) ─
	tunnelProxy := api.HandleTunnelProxy(hub, cfg.TunnelDomain)
	tunnelHandler := middleware.CORSMiddleware(tunnelProxy)

	// Create HTTP servers with timeouts
	apiSrv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	proxySrv := &http.Server{
		Addr:              ":8081",
		Handler:           tunnelHandler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	// Start proxy server
	go func() {
		log.Printf("[server] Tunnel proxy listening on :8081 for *.%s", cfg.TunnelDomain)
		if err := proxySrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Tunnel proxy server failed: %v", err)
		}
	}()

	log.Printf("[server] UltraSlim server starting on :%s", cfg.Port)
	log.Printf("[server] Dashboard: http://localhost:%s", cfg.Port)
	log.Printf("[server] Agent WS: ws://localhost:%s/ws/agent", cfg.Port)
	log.Printf("[server] API: http://localhost:%s/api/", cfg.Port)

	// Start API server in a goroutine
	go func() {
		if err := apiSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	// Wait for shutdown signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("[server] Shutdown signal received, gracefully stopping...")

	// Give a 30-second window for graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Close all agent connections
	if hub != nil {
		hub.DisconnectAll()
	}

	// Shutdown servers
	if err := apiSrv.Shutdown(ctx); err != nil {
		log.Printf("[server] API server shutdown error: %v", err)
	}
	if err := proxySrv.Shutdown(ctx); err != nil {
		log.Printf("[server] Proxy server shutdown error: %v", err)
	}

	log.Println("[server] Shutdown complete")
}

func createDefaultSuperadmin() {
	var count int
	db.DB.QueryRow(`SELECT COUNT(*) FROM users WHERE role = 'superadmin'`).Scan(&count)
	if count > 0 {
		return
	}

	email := os.Getenv("ADMIN_EMAIL")
	password := os.Getenv("ADMIN_PASSWORD")
	if email == "" || password == "" {
		log.Fatalf("[server] ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required for initial setup")
	}

	hash, err := auth.HashPassword(password)
	if err != nil {
		log.Fatalf("[server] Failed to hash admin password: %v", err)
	}

	_, err = db.DB.Exec(`
		INSERT INTO users (email, password_hash, display_name, role, max_tunnels)
		VALUES ($1, $2, 'Admin', 'superadmin', 100)
		ON CONFLICT (email) DO UPDATE SET role = 'superadmin'
	`, email, hash)
	if err != nil {
		log.Printf("[server] Failed to create default superadmin: %v", err)
	} else {
		log.Printf("[server] Default superadmin created: %s", email)
	}
}

// spaHandler serves the React SPA
type spaHandler struct {
	staticPath string
	indexPath  string
}

func (h spaHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// API and WS routes are handled by the mux, this only handles static files
	path := r.URL.Path

	// Don't serve static files for API/WS routes
	if strings.HasPrefix(path, "/api/") || strings.HasPrefix(path, "/ws/") {
		http.NotFound(w, r)
		return
	}

	// Try to serve the file from static directory
	fs := http.Dir(h.staticPath)
	file, err := fs.Open(path)
	if err != nil {
		// File doesn't exist, serve index.html for SPA routing
		http.ServeFile(w, r, h.staticPath+"/"+h.indexPath)
		return
	}
	file.Close()

	http.FileServer(fs).ServeHTTP(w, r)
}
