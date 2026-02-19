package api

import (
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/ultraslim/server/internal/auth"
	"github.com/ultraslim/server/internal/db"
	"github.com/ultraslim/server/internal/middleware"
	"github.com/ultraslim/server/internal/models"
	"github.com/ultraslim/server/internal/relay"
)

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func readJSON(r *http.Request, v interface{}) error {
	return json.NewDecoder(r.Body).Decode(v)
}

// ── Auth ─────────────────────────────────────────────────

func HandleSignup(w http.ResponseWriter, r *http.Request) {
	var req models.SignupRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if req.Email == "" || req.Password == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "email and password required"})
		return
	}

	if len(req.Password) < 6 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "password must be at least 6 characters"})
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to hash password"})
		return
	}

	displayName := req.DisplayName
	if displayName == "" {
		displayName = strings.Split(req.Email, "@")[0]
	}

	var user models.User
	err = db.DB.QueryRow(`
		INSERT INTO users (email, password_hash, display_name, role)
		VALUES ($1, $2, $3, 'user')
		RETURNING id, email, display_name, avatar_url, max_tunnels, role, created_at, updated_at
	`, req.Email, hash, displayName).Scan(
		&user.ID, &user.Email, &user.DisplayName, &user.AvatarURL,
		&user.MaxTunnels, &user.Role, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "email already registered"})
			return
		}
		log.Printf("[api] Signup error: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create user"})
		return
	}

	token, err := auth.GenerateToken(user.ID, user.Email, user.Role)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to generate token"})
		return
	}

	writeJSON(w, http.StatusCreated, models.AuthResponse{Token: token, User: user})
}

func HandleLogin(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	var user models.User
	err := db.DB.QueryRow(`
		SELECT id, email, password_hash, display_name, avatar_url, max_tunnels, role, created_at, updated_at
		FROM users WHERE email = $1
	`, req.Email).Scan(
		&user.ID, &user.Email, &user.PasswordHash, &user.DisplayName, &user.AvatarURL,
		&user.MaxTunnels, &user.Role, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid email or password"})
		return
	}

	if !auth.CheckPassword(user.PasswordHash, req.Password) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid email or password"})
		return
	}

	token, err := auth.GenerateToken(user.ID, user.Email, user.Role)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to generate token"})
		return
	}

	writeJSON(w, http.StatusOK, models.AuthResponse{Token: token, User: user})
}

func HandleGetProfile(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	var user models.User
	err := db.DB.QueryRow(`
		SELECT id, email, display_name, avatar_url, max_tunnels, role, created_at, updated_at
		FROM users WHERE id = $1
	`, claims.UserID).Scan(
		&user.ID, &user.Email, &user.DisplayName, &user.AvatarURL,
		&user.MaxTunnels, &user.Role, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
		return
	}
	writeJSON(w, http.StatusOK, user)
}

func HandleUpdateProfile(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	var req models.UpdateProfileRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	_, err := db.DB.Exec(`
		UPDATE users SET display_name = COALESCE(NULLIF($1, ''), display_name),
		avatar_url = COALESCE(NULLIF($2, ''), avatar_url), updated_at = NOW()
		WHERE id = $3
	`, req.DisplayName, req.AvatarURL, claims.UserID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to update profile"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// ── Tunnels ──────────────────────────────────────────────

func HandleGetTunnels(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	rows, err := db.DB.Query(`
		SELECT id, user_id, tunnel_id, type, local_port, public_endpoint, status,
			bytes_in, bytes_out, connections, assigned_port, expires_at, created_at, updated_at
		FROM tunnels WHERE user_id = $1 ORDER BY created_at DESC
	`, claims.UserID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to fetch tunnels"})
		return
	}
	defer rows.Close()

	tunnels := []models.Tunnel{}
	for rows.Next() {
		var t models.Tunnel
		rows.Scan(&t.ID, &t.UserID, &t.TunnelID, &t.Type, &t.LocalPort,
			&t.PublicEndpoint, &t.Status, &t.BytesIn, &t.BytesOut,
			&t.Connections, &t.AssignedPort, &t.ExpiresAt, &t.CreatedAt, &t.UpdatedAt)

		// Check if agent is actually connected
		if relay.RelayHub != nil && relay.RelayHub.IsAgentConnected(t.TunnelID) {
			t.Status = "online"
		} else if t.Status == "online" {
			t.Status = "offline"
			db.DB.Exec(`UPDATE tunnels SET status = 'offline' WHERE id = $1`, t.ID)
		}

		tunnels = append(tunnels, t)
	}

	writeJSON(w, http.StatusOK, tunnels)
}

func HandleDeleteTunnel(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	tunnelID := r.URL.Query().Get("id")
	if tunnelID == "" {
		// Try path parameter
		parts := strings.Split(r.URL.Path, "/")
		if len(parts) > 0 {
			tunnelID = parts[len(parts)-1]
		}
	}

	if tunnelID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "tunnel id required"})
		return
	}

	// Get tunnel info for notification
	var tid string
	db.DB.QueryRow(`SELECT tunnel_id FROM tunnels WHERE id = $1 AND user_id = $2`, tunnelID, claims.UserID).Scan(&tid)

	res, err := db.DB.Exec(`DELETE FROM tunnels WHERE id = $1 AND user_id = $2`, tunnelID, claims.UserID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to delete tunnel"})
		return
	}

	n, _ := res.RowsAffected()
	if n == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "tunnel not found"})
		return
	}

	// Disconnect agent if connected (marks tunnel as deleted to skip DB updates in removeAgent)
	if relay.RelayHub != nil && tid != "" {
		relay.RelayHub.DeleteAndDisconnect(tid)
	}

	// Notification and audit
	db.DB.Exec(`INSERT INTO notifications (user_id, title, message, type)
		VALUES ($1, 'Tunnel Deleted', $2, 'info')`,
		claims.UserID, fmt.Sprintf("Tunnel %s has been deleted", tid))

	db.DB.Exec(`INSERT INTO audit_logs (user_id, action, target_type, target_id)
		VALUES ($1, 'tunnel.deleted', 'tunnel', $2)`, claims.UserID, tid)

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// ── API Keys ─────────────────────────────────────────────

func HandleGetAPIKeys(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	rows, err := db.DB.Query(`
		SELECT id, user_id, name, key_prefix, last_used_at, expires_at, revoked, created_at
		FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC
	`, claims.UserID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to fetch API keys"})
		return
	}
	defer rows.Close()

	keys := []models.APIKey{}
	for rows.Next() {
		var k models.APIKey
		rows.Scan(&k.ID, &k.UserID, &k.Name, &k.KeyPrefix, &k.LastUsed, &k.ExpiresAt, &k.Revoked, &k.CreatedAt)
		keys = append(keys, k)
	}
	writeJSON(w, http.StatusOK, keys)
}

func HandleCreateAPIKey(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	var req models.CreateAPIKeyRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	key, prefix, hash := auth.GenerateAPIKey()

	var expiresAt *time.Time
	if req.ExpiresAt != "" {
		t, err := time.Parse(time.RFC3339, req.ExpiresAt)
		if err == nil {
			expiresAt = &t
		}
	}

	var apiKey models.APIKey
	err := db.DB.QueryRow(`
		INSERT INTO api_keys (user_id, name, key_prefix, key_hash, expires_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, user_id, name, key_prefix, last_used_at, expires_at, revoked, created_at
	`, claims.UserID, req.Name, prefix, hash, expiresAt).Scan(
		&apiKey.ID, &apiKey.UserID, &apiKey.Name, &apiKey.KeyPrefix,
		&apiKey.LastUsed, &apiKey.ExpiresAt, &apiKey.Revoked, &apiKey.CreatedAt,
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create API key"})
		return
	}

	writeJSON(w, http.StatusCreated, models.CreateAPIKeyResponse{APIKey: apiKey, Key: key})
}

func HandleDeleteAPIKey(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	parts := strings.Split(r.URL.Path, "/")
	keyID := parts[len(parts)-1]

	_, err := db.DB.Exec(`DELETE FROM api_keys WHERE id = $1 AND user_id = $2`, keyID, claims.UserID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to delete API key"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// ── Webhooks ─────────────────────────────────────────────

func HandleGetWebhooks(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	rows, err := db.DB.Query(`
		SELECT id, user_id, name, url, events, secret, active, last_triggered_at, failure_count, created_at
		FROM webhooks WHERE user_id = $1 ORDER BY created_at DESC
	`, claims.UserID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to fetch webhooks"})
		return
	}
	defer rows.Close()

	webhooks := []models.Webhook{}
	for rows.Next() {
		var wh models.Webhook
		var events string
		rows.Scan(&wh.ID, &wh.UserID, &wh.Name, &wh.URL, &events, &wh.Secret,
			&wh.Active, &wh.LastTriggered, &wh.FailureCount, &wh.CreatedAt)
		// Parse PostgreSQL array
		events = strings.Trim(events, "{}")
		if events != "" {
			wh.Events = strings.Split(events, ",")
		}
		webhooks = append(webhooks, wh)
	}
	writeJSON(w, http.StatusOK, webhooks)
}

func HandleCreateWebhook(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	var req models.CreateWebhookRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	secret := auth.GenerateWebhookSecret()
	eventsArray := "{" + strings.Join(req.Events, ",") + "}"

	var wh models.Webhook
	var events string
	err := db.DB.QueryRow(`
		INSERT INTO webhooks (user_id, name, url, events, secret)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, user_id, name, url, events, secret, active, last_triggered_at, failure_count, created_at
	`, claims.UserID, req.Name, req.URL, eventsArray, secret).Scan(
		&wh.ID, &wh.UserID, &wh.Name, &wh.URL, &events, &wh.Secret,
		&wh.Active, &wh.LastTriggered, &wh.FailureCount, &wh.CreatedAt,
	)
	if err != nil {
		log.Printf("[api] Create webhook error: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create webhook"})
		return
	}
	events = strings.Trim(events, "{}")
	if events != "" {
		wh.Events = strings.Split(events, ",")
	}

	writeJSON(w, http.StatusCreated, wh)
}

func HandleDeleteWebhook(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	parts := strings.Split(r.URL.Path, "/")
	whID := parts[len(parts)-1]

	_, err := db.DB.Exec(`DELETE FROM webhooks WHERE id = $1 AND user_id = $2`, whID, claims.UserID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to delete webhook"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func HandleUpdateWebhook(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	parts := strings.Split(r.URL.Path, "/")
	whID := parts[len(parts)-1]

	var body map[string]interface{}
	if err := readJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if active, ok := body["active"]; ok {
		db.DB.Exec(`UPDATE webhooks SET active = $1 WHERE id = $2 AND user_id = $3`, active, whID, claims.UserID)
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

// ── Notifications ────────────────────────────────────────

func HandleGetNotifications(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	rows, err := db.DB.Query(`
		SELECT id, user_id, title, message, type, read, created_at
		FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50
	`, claims.UserID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to fetch notifications"})
		return
	}
	defer rows.Close()

	notifs := []models.Notification{}
	for rows.Next() {
		var n models.Notification
		rows.Scan(&n.ID, &n.UserID, &n.Title, &n.Message, &n.Type, &n.Read, &n.CreatedAt)
		notifs = append(notifs, n)
	}
	writeJSON(w, http.StatusOK, notifs)
}

func HandleMarkNotificationRead(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	parts := strings.Split(r.URL.Path, "/")
	notifID := parts[len(parts)-2] // .../notifications/{id}/read

	db.DB.Exec(`UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2`, notifID, claims.UserID)
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func HandleMarkAllNotificationsRead(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	db.DB.Exec(`UPDATE notifications SET read = TRUE WHERE user_id = $1`, claims.UserID)
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func HandleDeleteNotifications(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	db.DB.Exec(`DELETE FROM notifications WHERE user_id = $1`, claims.UserID)
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// ── Analytics ────────────────────────────────────────────

func HandleGetAnalytics(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	var stats models.BandwidthStats

	db.DB.QueryRow(`
		SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'online'),
		COALESCE(SUM(bytes_in), 0), COALESCE(SUM(bytes_out), 0)
		FROM tunnels WHERE user_id = $1
	`, claims.UserID).Scan(&stats.TotalTunnels, &stats.ActiveTunnels, &stats.TotalBytesIn, &stats.TotalBytesOut)

	writeJSON(w, http.StatusOK, stats)
}

func HandleGetConnectionLogs(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	rows, err := db.DB.Query(`
		SELECT cl.id, cl.tunnel_id, cl.user_id, cl.source_ip, cl.method, cl.path,
			cl.status_code, cl.latency_ms, cl.bytes_transferred, cl.created_at
		FROM connection_logs cl WHERE cl.user_id = $1
		ORDER BY cl.created_at DESC LIMIT 100
	`, claims.UserID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to fetch connection logs"})
		return
	}
	defer rows.Close()

	logs := []models.ConnectionLog{}
	for rows.Next() {
		var l models.ConnectionLog
		rows.Scan(&l.ID, &l.TunnelID, &l.UserID, &l.SourceIP, &l.Method, &l.Path,
			&l.StatusCode, &l.LatencyMs, &l.BytesTransferred, &l.CreatedAt)
		logs = append(logs, l)
	}
	writeJSON(w, http.StatusOK, logs)
}

// ── Health Check ─────────────────────────────────────────

func HandleTunnelHealthCheck(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	tunnelDBID := parts[len(parts)-2] // .../tunnels/{id}/health

	var tunnelID string
	err := db.DB.QueryRow(`SELECT tunnel_id FROM tunnels WHERE id = $1`, tunnelDBID).Scan(&tunnelID)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "tunnel not found"})
		return
	}

	connected := relay.RelayHub != nil && relay.RelayHub.IsAgentConnected(tunnelID)

	status := "down"
	latency := 0
	if connected {
		status = "healthy"
		latency = 5 // Placeholder; real implementation would ping the agent
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"tunnel_id": tunnelID,
		"status":    status,
		"latency":   latency,
		"checked_at": time.Now(),
	})
}

// ── Config Export/Import ─────────────────────────────────

func HandleExportConfig(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	rows, err := db.DB.Query(`
		SELECT tunnel_id, type, local_port, public_endpoint FROM tunnels WHERE user_id = $1
	`, claims.UserID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to export"})
		return
	}
	defer rows.Close()

	type TunnelConfig struct {
		TunnelID  string `json:"tunnel_id"`
		Type      string `json:"type"`
		LocalPort int    `json:"local_port"`
		Endpoint  string `json:"public_endpoint"`
	}
	configs := []TunnelConfig{}
	for rows.Next() {
		var tc TunnelConfig
		rows.Scan(&tc.TunnelID, &tc.Type, &tc.LocalPort, &tc.Endpoint)
		configs = append(configs, tc)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"version":    "1.0",
		"exported_at": time.Now(),
		"tunnels":    configs,
	})
}

// ── Admin ────────────────────────────────────────────────

func HandleAdminGetUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := db.DB.Query(`
		SELECT u.id, u.email, u.display_name, u.role, u.max_tunnels, u.created_at,
			(SELECT COUNT(*) FROM tunnels t WHERE t.user_id = u.id) as tunnel_count
		FROM users u ORDER BY u.created_at DESC
	`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to fetch users"})
		return
	}
	defer rows.Close()

	type AdminUser struct {
		ID          string    `json:"id"`
		Email       string    `json:"email"`
		DisplayName string    `json:"display_name"`
		Role        string    `json:"role"`
		MaxTunnels  int       `json:"max_tunnels"`
		TunnelCount int       `json:"tunnel_count"`
		CreatedAt   time.Time `json:"created_at"`
	}

	users := []AdminUser{}
	for rows.Next() {
		var u AdminUser
		rows.Scan(&u.ID, &u.Email, &u.DisplayName, &u.Role, &u.MaxTunnels, &u.CreatedAt, &u.TunnelCount)
		users = append(users, u)
	}
	writeJSON(w, http.StatusOK, users)
}

func HandleAdminAssignRole(w http.ResponseWriter, r *http.Request) {
	var req models.AssignRoleRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if req.Role != "user" && req.Role != "admin" && req.Role != "superadmin" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid role"})
		return
	}

	_, err := db.DB.Exec(`UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2`, req.Role, req.UserID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to assign role"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "role assigned"})
}

func HandleAdminDeleteTunnel(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	tunnelID := parts[len(parts)-1]

	// Get tunnel_id for agent disconnect
	var tid string
	db.DB.QueryRow(`SELECT tunnel_id FROM tunnels WHERE id = $1`, tunnelID).Scan(&tid)

	_, err := db.DB.Exec(`DELETE FROM tunnels WHERE id = $1`, tunnelID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to delete tunnel"})
		return
	}

	if relay.RelayHub != nil && tid != "" {
		if agent := relay.RelayHub.GetAgent(tid); agent != nil {
			agent.Conn.Close()
		}
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func HandleAdminGetAllTunnels(w http.ResponseWriter, r *http.Request) {
	rows, err := db.DB.Query(`
		SELECT t.id, t.user_id, t.tunnel_id, t.type, t.local_port, t.public_endpoint,
			t.status, t.bytes_in, t.bytes_out, t.connections, t.created_at,
			u.email, u.display_name
		FROM tunnels t JOIN users u ON u.id = t.user_id
		ORDER BY t.created_at DESC
	`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to fetch tunnels"})
		return
	}
	defer rows.Close()

	type AdminTunnel struct {
		models.Tunnel
		OwnerEmail string `json:"owner_email"`
		OwnerName  string `json:"owner_name"`
	}

	tunnels := []AdminTunnel{}
	for rows.Next() {
		var at AdminTunnel
		rows.Scan(&at.ID, &at.UserID, &at.TunnelID, &at.Type, &at.LocalPort,
			&at.PublicEndpoint, &at.Status, &at.BytesIn, &at.BytesOut,
			&at.Connections, &at.CreatedAt, &at.OwnerEmail, &at.OwnerName)
		tunnels = append(tunnels, at)
	}
	writeJSON(w, http.StatusOK, tunnels)
}

func HandleAdminGetAuditLogs(w http.ResponseWriter, r *http.Request) {
	rows, err := db.DB.Query(`
		SELECT al.id, al.user_id, al.action, al.target_type, al.target_id, al.ip_address, al.created_at,
			u.email
		FROM audit_logs al JOIN users u ON u.id = al.user_id
		ORDER BY al.created_at DESC LIMIT 200
	`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to fetch audit logs"})
		return
	}
	defer rows.Close()

	type AuditLogWithUser struct {
		models.AuditLog
		UserEmail string `json:"user_email"`
	}

	logs := []AuditLogWithUser{}
	for rows.Next() {
		var al AuditLogWithUser
		rows.Scan(&al.ID, &al.UserID, &al.Action, &al.TargetType, &al.TargetID,
			&al.IPAddress, &al.CreatedAt, &al.UserEmail)
		logs = append(logs, al)
	}
	writeJSON(w, http.StatusOK, logs)
}

// ── Tunnel HTTP Proxy Handler ────────────────────────────

func HandleTunnelProxy(hub *relay.Hub, domain string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host := r.Host
		// Strip port if present
		if idx := strings.LastIndex(host, ":"); idx != -1 {
			host = host[:idx]
		}

		// Check if this is a tunnel subdomain request
		if !strings.HasSuffix(host, "."+domain) {
			http.Error(w, "Not found", http.StatusNotFound)
			return
		}

		agent := hub.GetAgentBySubdomain(host)
		if agent == nil {
			writeJSON(w, http.StatusBadGateway, map[string]string{
				"error": "tunnel not found or offline",
				"hint":  "The tunnel may have disconnected. Check your CLI agent.",
			})
			return
		}

		resp, err := hub.ProxyHTTPRequest(agent, r)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]string{
				"error": fmt.Sprintf("proxy error: %v", err),
			})
			return
		}

		// Write response headers
		for k, v := range resp.Headers {
			w.Header().Set(k, v)
		}

		w.WriteHeader(resp.StatusCode)

		if resp.Body != "" {
			bodyBytes, err := base64.StdEncoding.DecodeString(resp.Body)
			if err != nil {
				w.Write([]byte(resp.Body))
			} else {
				w.Write(bodyBytes)
			}
		}

		// Log connection
		go func() {
			latency := 0 // Would be calculated from timing
			db.DB.Exec(`
				INSERT INTO connection_logs (tunnel_id, user_id, source_ip, method, path, status_code, latency_ms, bytes_transferred)
				VALUES ((SELECT id FROM tunnels WHERE tunnel_id = $1), $2, $3, $4, $5, $6, $7, $8)
			`, agent.TunnelID, agent.UserID, r.RemoteAddr, r.Method, r.URL.Path, resp.StatusCode, latency, len(resp.Body))
		}()
	})
}

// ── System Health ────────────────────────────────────────

func HandleSystemHealth(w http.ResponseWriter, r *http.Request) {
	dbOK := true
	if err := db.DB.Ping(); err != nil {
		dbOK = false
	}

	var userCount, tunnelCount int
	db.DB.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&userCount)
	db.DB.QueryRow(`SELECT COUNT(*) FROM tunnels WHERE status = 'online'`).Scan(&tunnelCount)

	activeTunnels := 0
	if relay.RelayHub != nil {
		activeTunnels = relay.RelayHub.GetActiveTunnelCount()
	}

	status := "healthy"
	if !dbOK {
		status = "degraded"
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":          status,
		"database":        dbOK,
		"active_agents":   activeTunnels,
		"total_users":     userCount,
		"online_tunnels":  tunnelCount,
		"uptime":          time.Since(startTime).String(),
		"version":         "1.0.0",
	})
}

var startTime = time.Now()

// ── Password Reset (secure two-step flow) ──────────────────────────

func HandleForgotPassword(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email string `json:"email"`
	}
	if err := readJSON(r, &body); err != nil || body.Email == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "email required"})
		return
	}

	// Check if user exists
	var userID string
	err := db.DB.QueryRow(`SELECT id FROM users WHERE email = $1`, body.Email).Scan(&userID)
	if err == sql.ErrNoRows {
		// Always return success to prevent email enumeration
		writeJSON(w, http.StatusOK, map[string]string{
			"message": "If an account with that email exists, a reset link has been sent.",
		})
		return
	}
	if err != nil {
		log.Printf("[api] ForgotPassword query error: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "server error"})
		return
	}

	// Generate reset token
	token, tokenHash, err := auth.GeneratePasswordResetToken()
	if err != nil {
		log.Printf("[api] Failed to generate reset token: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "server error"})
		return
	}

	// Store token in DB with 15-minute expiry
	_, err = db.DB.Exec(
		`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '15 minutes')`,
		userID, tokenHash,
	)
	if err != nil {
		log.Printf("[api] Failed to store reset token: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "server error"})
		return
	}

	// TODO: Send email with reset link containing the token
	// For now, log the token to stdout for testing
	log.Printf("[api] Password reset token for %s: %s (valid for 15 minutes)", body.Email, token)

	// Always return success to prevent email enumeration
	writeJSON(w, http.StatusOK, map[string]string{
		"message": "If an account with that email exists, a reset link has been sent.",
	})
}

func HandleResetPassword(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Token       string `json:"token"`
		NewPassword string `json:"new_password"`
	}
	if err := readJSON(r, &body); err != nil || body.Token == "" || body.NewPassword == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "token and new_password required"})
		return
	}

	if len(body.NewPassword) < 6 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "password must be at least 6 characters"})
		return
	}

	// Hash the provided token to look it up
	hash := sha256.Sum256([]byte(body.Token))
	tokenHash := hex.EncodeToString(hash[:])

	// Look up and validate the token
	var userID string
	var used bool
	err := db.DB.QueryRow(
		`SELECT user_id, used FROM password_reset_tokens WHERE token_hash = $1 AND expires_at > NOW() LIMIT 1`,
		tokenHash,
	).Scan(&userID, &used)

	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid or expired token"})
		return
	}
	if err != nil {
		log.Printf("[api] ResetPassword query error: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "server error"})
		return
	}

	if used {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "token already used"})
		return
	}

	// Hash the new password
	pwdHash, err := auth.HashPassword(body.NewPassword)
	if err != nil {
		log.Printf("[api] Failed to hash password: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "server error"})
		return
	}

	// Update password and mark token as used (atomic transaction)
	tx, err := db.DB.Begin()
	if err != nil {
		log.Printf("[api] Failed to begin transaction: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "server error"})
		return
	}
	defer tx.Rollback()

	// Update password
	_, err = tx.Exec(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, pwdHash, userID)
	if err != nil {
		log.Printf("[api] Failed to update password: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "server error"})
		return
	}

	// Mark token as used
	_, err = tx.Exec(`UPDATE password_reset_tokens SET used = TRUE WHERE token_hash = $1`, tokenHash)
	if err != nil {
		log.Printf("[api] Failed to mark token as used: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "server error"})
		return
	}

	if err = tx.Commit(); err != nil {
		log.Printf("[api] Failed to commit transaction: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "server error"})
		return
	}

	// Log the successful reset
	var email string
	db.DB.QueryRow(`SELECT email FROM users WHERE id = $1`, userID).Scan(&email)
	log.Printf("[api] Password reset successful for %s", email)

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "message": "password updated successfully"})
}

// HandleRefreshToken generates a new token from a valid existing one
func HandleRefreshToken(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	if claims == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid token"})
		return
	}

	// Refresh role from DB
	var role string
	db.DB.QueryRow(`SELECT role FROM users WHERE id = $1`, claims.UserID).Scan(&role)

	token, err := auth.GenerateToken(claims.UserID, claims.Email, role)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to refresh token"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"token": token})
}

// Unused import guard
var _ = sql.ErrNoRows
var _ = base64.StdEncoding
