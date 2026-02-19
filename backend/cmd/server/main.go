package main

import (
	"log"
	"net/http"
	"os"
	"strings"

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

	// ── Public routes ────────────────────────────────────
	mux.HandleFunc("POST /api/auth/signup", api.HandleSignup)
	mux.HandleFunc("POST /api/auth/login", api.HandleLogin)
	mux.HandleFunc("POST /api/auth/forgot-password", api.HandleForgotPassword)
	mux.HandleFunc("POST /api/auth/reset-password", api.HandleResetPassword)
	mux.HandleFunc("GET /api/health", api.HandleSystemHealth)

	// ── Agent WebSocket ──────────────────────────────────
	mux.HandleFunc("GET /ws/agent", hub.HandleAgentConnect)

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

	// Start the main API + dashboard server
	go func() {
		log.Printf("[server] Tunnel proxy listening on :8081 for *.%s", cfg.TunnelDomain)
		if err := http.ListenAndServe(":8081", tunnelHandler); err != nil {
			log.Fatalf("Tunnel proxy server failed: %v", err)
		}
	}()

	log.Printf("[server] UltraSlim server starting on :%s", cfg.Port)
	log.Printf("[server] Dashboard: http://localhost:%s", cfg.Port)
	log.Printf("[server] Agent WS: ws://localhost:%s/ws/agent", cfg.Port)
	log.Printf("[server] API: http://localhost:%s/api/", cfg.Port)

	if err := http.ListenAndServe(":"+cfg.Port, handler); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func createDefaultSuperadmin() {
	var count int
	db.DB.QueryRow(`SELECT COUNT(*) FROM users WHERE role = 'superadmin'`).Scan(&count)
	if count > 0 {
		return
	}

	email := os.Getenv("ADMIN_EMAIL")
	password := os.Getenv("ADMIN_PASSWORD")
	if email == "" {
		email = "admin@ultraslim.dev"
	}
	if password == "" {
		password = "UltraSlim@2026!"
	}

	hash, _ := auth.HashPassword(password)
	_, err := db.DB.Exec(`
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
