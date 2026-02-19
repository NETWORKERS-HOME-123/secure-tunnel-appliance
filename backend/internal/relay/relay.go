package relay

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
	"github.com/ultraslim/server/internal/auth"
	"github.com/ultraslim/server/internal/db"
	"github.com/ultraslim/server/internal/models"
)

var upgrader = websocket.Upgrader{
	CheckOrigin:     func(r *http.Request) bool { return true },
	ReadBufferSize:  65536,
	WriteBufferSize: 65536,
}

// DashClient represents a dashboard WebSocket connection with write synchronization
type DashClient struct {
	Conn *websocket.Conn
	mu   sync.Mutex
}

func (dc *DashClient) WriteJSON(v interface{}) error {
	dc.mu.Lock()
	defer dc.mu.Unlock()
	return dc.Conn.WriteJSON(v)
}

// AgentConn represents a connected CLI agent
type AgentConn struct {
	Conn           *websocket.Conn
	UserID         string
	TunnelID       string
	TunnelDBID     string
	Type           string
	LocalPort      int
	AssignedPort   int // TCP port assigned to this tunnel
	Endpoint       string
	deleted        bool // true if tunnel was deleted, skips DB cleanup in removeAgent
	done           chan struct{}
	mu             sync.Mutex
	pending        map[string]chan *models.ProxyResponsePayload
	pendingMu      sync.Mutex
	connectedAt    time.Time
}

// Hub manages all active agent connections
type Hub struct {
	agents       map[string]*AgentConn // keyed by tunnel_id (e.g., "tn_abc123")
	mu           sync.RWMutex
	domain       string
	tcpPortMin   int
	tcpPortMax   int
	nextTCPPort  int32
	tcpListeners map[int]net.Listener
	tcpMu        sync.Mutex

	// Dashboard WebSocket connections
	dashClients map[string][]*DashClient // keyed by user_id
	dashMu      sync.RWMutex
}

var RelayHub *Hub

func NewHub(domain string, tcpMin, tcpMax int) *Hub {
	h := &Hub{
		agents:       make(map[string]*AgentConn),
		domain:       domain,
		tcpPortMin:   tcpMin,
		tcpPortMax:   tcpMax,
		nextTCPPort:  int32(tcpMin),
		tcpListeners: make(map[int]net.Listener),
		dashClients:  make(map[string][]*DashClient),
	}
	RelayHub = h
	return h
}

func (h *Hub) allocateTCPPort() int {
	for {
		port := int(atomic.AddInt32(&h.nextTCPPort, 1))
		if port > h.tcpPortMax {
			atomic.StoreInt32(&h.nextTCPPort, int32(h.tcpPortMin))
			port = h.tcpPortMin
		}
		h.tcpMu.Lock()
		if _, exists := h.tcpListeners[port]; !exists {
			h.tcpMu.Unlock()
			return port
		}
		h.tcpMu.Unlock()
	}
}

// HandleAgentConnect handles CLI agent WebSocket connections
func (h *Hub) HandleAgentConnect(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[relay] WebSocket upgrade error: %v", err)
		return
	}

	log.Printf("[relay] New agent connection from %s", r.RemoteAddr)

	// Read registration message
	_, msg, err := conn.ReadMessage()
	if err != nil {
		log.Printf("[relay] Failed to read registration: %v", err)
		conn.Close()
		return
	}

	var ctrlMsg models.ControlMessage
	if err := json.Unmarshal(msg, &ctrlMsg); err != nil {
		log.Printf("[relay] Invalid control message: %v", err)
		conn.Close()
		return
	}

	if ctrlMsg.Type != "register" {
		conn.WriteJSON(models.ControlMessage{Type: "error", Payload: "expected register message"})
		conn.Close()
		return
	}

	payloadBytes, _ := json.Marshal(ctrlMsg.Payload)
	var reg models.RegisterTunnelPayload
	if err := json.Unmarshal(payloadBytes, &reg); err != nil {
		conn.WriteJSON(models.ControlMessage{Type: "error", Payload: "invalid register payload"})
		conn.Close()
		return
	}

	// Authenticate
	var userID, userEmail, userRole string
	if reg.Token != "" {
		claims, err := auth.ValidateToken(reg.Token)
		if err != nil {
			conn.WriteJSON(models.ControlMessage{Type: "error", Payload: "invalid token"})
			conn.Close()
			return
		}
		userID = claims.UserID
		userEmail = claims.Email
		userRole = claims.Role
	} else if reg.APIKey != "" {
		keyHash := auth.HashAPIKey(reg.APIKey)
		var uid, role string
		err := db.DB.QueryRow(`
			SELECT u.id, u.role FROM api_keys ak
			JOIN users u ON u.id = ak.user_id
			WHERE ak.key_hash = $1 AND ak.revoked = false
			AND (ak.expires_at IS NULL OR ak.expires_at > NOW())
		`, keyHash).Scan(&uid, &role)
		if err != nil {
			conn.WriteJSON(models.ControlMessage{Type: "error", Payload: "invalid API key"})
			conn.Close()
			return
		}
		userID = uid
		userRole = role
		db.DB.Exec(`UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = $1`, keyHash)
	} else {
		conn.WriteJSON(models.ControlMessage{Type: "error", Payload: "authentication required"})
		conn.Close()
		return
	}

	_ = userEmail
	_ = userRole

	tunnelID := auth.GenerateTunnelID()
	tunnelType := reg.Type
	if tunnelType == "" {
		tunnelType = "http"
	}

	var endpoint string
	var assignedPort int

	switch tunnelType {
	case "http", "ws":
		endpoint = fmt.Sprintf("https://%s.%s", tunnelID, h.domain)
	case "tcp", "ssh", "rdp", "udp":
		assignedPort = h.allocateTCPPort()
		endpoint = fmt.Sprintf("%s:%d", h.domain, assignedPort)
	default:
		conn.WriteJSON(models.ControlMessage{Type: "error", Payload: "unsupported tunnel type"})
		conn.Close()
		return
	}

	// Check tunnel limit and insert in a transaction (atomic operation)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	tx, err := db.DB.BeginTx(ctx, nil)
	if err != nil {
		log.Printf("[relay] Failed to begin transaction: %v", err)
		conn.WriteJSON(models.ControlMessage{Type: "error", Payload: "server error"})
		conn.Close()
		return
	}
	defer tx.Rollback()

	// Lock the user row to prevent concurrent tunnel creation from exceeding limit
	var maxTunnels int
	err = tx.QueryRowContext(ctx, `SELECT max_tunnels FROM users WHERE id = $1 FOR UPDATE`, userID).Scan(&maxTunnels)
	if err != nil {
		log.Printf("[relay] Failed to lock user: %v", err)
		conn.WriteJSON(models.ControlMessage{Type: "error", Payload: "server error"})
		conn.Close()
		return
	}
	if maxTunnels == 0 {
		maxTunnels = 5
	}

	// Count online tunnels
	var tunnelCount int
	err = tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM tunnels WHERE user_id = $1 AND status = 'online'`, userID).Scan(&tunnelCount)
	if err != nil {
		log.Printf("[relay] Failed to count tunnels: %v", err)
		conn.WriteJSON(models.ControlMessage{Type: "error", Payload: "server error"})
		conn.Close()
		return
	}

	if tunnelCount >= maxTunnels {
		conn.WriteJSON(models.ControlMessage{Type: "error", Payload: fmt.Sprintf("tunnel limit reached (%d/%d)", tunnelCount, maxTunnels)})
		conn.Close()
		return
	}

	// Insert tunnel in DB within the transaction
	var dbID string
	err = tx.QueryRowContext(ctx, `
		INSERT INTO tunnels (user_id, tunnel_id, type, local_port, public_endpoint, status, assigned_port)
		VALUES ($1, $2, $3, $4, $5, 'online', $6)
		RETURNING id
	`, userID, tunnelID, tunnelType, reg.LocalPort, endpoint, assignedPort).Scan(&dbID)
	if err != nil {
		log.Printf("[relay] Failed to insert tunnel: %v", err)
		conn.WriteJSON(models.ControlMessage{Type: "error", Payload: "failed to create tunnel"})
		conn.Close()
		return
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		log.Printf("[relay] Failed to commit transaction: %v", err)
		conn.WriteJSON(models.ControlMessage{Type: "error", Payload: "failed to create tunnel"})
		conn.Close()
		return
	}

	// Create notification
	db.DB.Exec(`INSERT INTO notifications (user_id, title, message, type)
		VALUES ($1, 'Tunnel Created', $2, 'success')`,
		userID, fmt.Sprintf("Tunnel %s is now online at %s", tunnelID, endpoint))

	// Create audit log
	db.DB.Exec(`INSERT INTO audit_logs (user_id, action, target_type, target_id)
		VALUES ($1, 'tunnel.created', 'tunnel', $2)`, userID, tunnelID)

	agent := &AgentConn{
		Conn:         conn,
		UserID:       userID,
		TunnelID:     tunnelID,
		TunnelDBID:   dbID,
		Type:         tunnelType,
		LocalPort:    reg.LocalPort,
		AssignedPort: assignedPort,
		Endpoint:     endpoint,
		done:         make(chan struct{}),
		pending:      make(map[string]chan *models.ProxyResponsePayload),
		connectedAt:  time.Now(),
	}

	h.mu.Lock()
	h.agents[tunnelID] = agent
	h.mu.Unlock()

	// Start TCP listener if needed
	if assignedPort > 0 {
		go h.startTCPListener(agent, assignedPort)
	}

	// Send registration success
	conn.WriteJSON(models.ControlMessage{
		Type: "registered",
		Payload: models.TunnelRegisteredPayload{
			TunnelID:       tunnelID,
			PublicEndpoint: endpoint,
			AssignedPort:   assignedPort,
		},
	})

	log.Printf("[relay] Tunnel %s registered for user %s: %s -> localhost:%d", tunnelID, userID, endpoint, reg.LocalPort)

	// Broadcast to dashboard
	h.BroadcastToUser(userID, models.RealtimeEvent{
		Event: "INSERT",
		Table: "tunnels",
	})

	// Handle agent messages (proxy responses, heartbeats)
	go h.handleAgentMessages(agent)
}

func (h *Hub) handleAgentMessages(agent *AgentConn) {
	defer h.removeAgent(agent)

	// Set up ping/pong for keepalive
	agent.Conn.SetPongHandler(func(string) error {
		agent.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	// Start ping ticker
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-agent.done:
				return
			case <-ticker.C:
				agent.mu.Lock()
				err := agent.Conn.WriteMessage(websocket.PingMessage, nil)
				agent.mu.Unlock()
				if err != nil {
					return
				}
			}
		}
	}()

	for {
		agent.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		_, msg, err := agent.Conn.ReadMessage()
		if err != nil {
			log.Printf("[relay] Agent %s disconnected: %v", agent.TunnelID, err)
			return
		}

		var ctrlMsg models.ControlMessage
		if err := json.Unmarshal(msg, &ctrlMsg); err != nil {
			continue
		}

		switch ctrlMsg.Type {
		case "proxy_response":
			payloadBytes, _ := json.Marshal(ctrlMsg.Payload)
			var resp models.ProxyResponsePayload
			if err := json.Unmarshal(payloadBytes, &resp); err != nil {
				continue
			}
			agent.pendingMu.Lock()
			if ch, ok := agent.pending[resp.RequestID]; ok {
				ch <- &resp
				delete(agent.pending, resp.RequestID)
			}
			agent.pendingMu.Unlock()

		case "heartbeat":
			agent.mu.Lock()
			agent.Conn.WriteJSON(models.ControlMessage{Type: "heartbeat_ack"})
			agent.mu.Unlock()
		}
	}
}

func (h *Hub) removeAgent(agent *AgentConn) {
	// Close the done channel to signal the ping goroutine to exit
	close(agent.done)

	h.mu.Lock()
	delete(h.agents, agent.TunnelID)
	h.mu.Unlock()

	// Close TCP listener if any (using cached AssignedPort field, not DB query)
	if agent.AssignedPort > 0 {
		h.tcpMu.Lock()
		if ln, exists := h.tcpListeners[agent.AssignedPort]; exists {
			ln.Close()
			delete(h.tcpListeners, agent.AssignedPort)
		}
		h.tcpMu.Unlock()
	}

	// Skip DB updates if tunnel was explicitly deleted
	if !agent.deleted {
		// Update DB
		db.DB.Exec(`UPDATE tunnels SET status = 'offline', updated_at = NOW() WHERE id = $1`, agent.TunnelDBID)

		// Create notification
		db.DB.Exec(`INSERT INTO notifications (user_id, title, message, type)
			VALUES ($1, 'Tunnel Offline', $2, 'warning')`,
			agent.UserID, fmt.Sprintf("Tunnel %s is now offline", agent.TunnelID))

		// Audit log
		db.DB.Exec(`INSERT INTO audit_logs (user_id, action, target_type, target_id)
			VALUES ($1, 'tunnel.offline', 'tunnel', $2)`, agent.UserID, agent.TunnelID)

		// Broadcast to dashboard
		h.BroadcastToUser(agent.UserID, models.RealtimeEvent{
			Event: "UPDATE",
			Table: "tunnels",
		})
	}

	agent.Conn.Close()
	log.Printf("[relay] Agent %s removed", agent.TunnelID)
}

// DeleteAndDisconnect marks a tunnel as deleted and disconnects the agent
func (h *Hub) DeleteAndDisconnect(tunnelID string) {
	h.mu.Lock()
	agent, exists := h.agents[tunnelID]
	h.mu.Unlock()

	if exists {
		agent.deleted = true
		agent.Conn.Close()
		// removeAgent will be called via defer in handleAgentMessages
	}
}

// DisconnectAll closes all agent connections (used during graceful shutdown)
func (h *Hub) DisconnectAll() {
	h.mu.Lock()
	agents := make([]*AgentConn, 0, len(h.agents))
	for _, agent := range h.agents {
		agents = append(agents, agent)
	}
	h.mu.Unlock()

	for _, agent := range agents {
		agent.Conn.Close()
	}
}

// GetAgent returns the agent for a tunnel ID
func (h *Hub) GetAgent(tunnelID string) *AgentConn {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.agents[tunnelID]
}

// GetAgentBySubdomain extracts tunnel ID from subdomain
func (h *Hub) GetAgentBySubdomain(host string) *AgentConn {
	// host is like "tn_abc123.21tunnel.com"
	parts := strings.SplitN(host, ".", 2)
	if len(parts) < 2 {
		return nil
	}
	tunnelID := parts[0]
	return h.GetAgent(tunnelID)
}

// ProxyHTTPRequest forwards an HTTP request through the agent's WebSocket
func (h *Hub) ProxyHTTPRequest(agent *AgentConn, r *http.Request) (*models.ProxyResponsePayload, error) {
	requestID := fmt.Sprintf("req_%d", time.Now().UnixNano())

	headers := make(map[string]string)
	for k, v := range r.Header {
		if len(v) > 0 {
			headers[k] = v[0]
		}
	}

	var bodyStr string
	if r.Body != nil {
		bodyBytes, err := io.ReadAll(io.LimitReader(r.Body, 10*1024*1024)) // 10MB limit
		if err == nil && len(bodyBytes) > 0 {
			bodyStr = base64.StdEncoding.EncodeToString(bodyBytes)
		}
	}

	proxyReq := models.ProxyRequestPayload{
		RequestID: requestID,
		Method:    r.Method,
		Path:      r.URL.RequestURI(),
		Headers:   headers,
		Body:      bodyStr,
	}

	respCh := make(chan *models.ProxyResponsePayload, 1)
	agent.pendingMu.Lock()
	agent.pending[requestID] = respCh
	agent.pendingMu.Unlock()

	agent.mu.Lock()
	err := agent.Conn.WriteJSON(models.ControlMessage{
		Type:    "proxy_request",
		Payload: proxyReq,
	})
	agent.mu.Unlock()

	if err != nil {
		agent.pendingMu.Lock()
		delete(agent.pending, requestID)
		agent.pendingMu.Unlock()
		return nil, fmt.Errorf("failed to send proxy request: %w", err)
	}

	// Update bytes_in
	db.DB.Exec(`UPDATE tunnels SET bytes_in = bytes_in + $1, connections = connections + 1, updated_at = NOW() WHERE id = $2`,
		len(bodyStr), agent.TunnelDBID)

	select {
	case resp := <-respCh:
		// Update bytes_out
		db.DB.Exec(`UPDATE tunnels SET bytes_out = bytes_out + $1, updated_at = NOW() WHERE id = $2`,
			len(resp.Body), agent.TunnelDBID)
		return resp, nil
	case <-time.After(30 * time.Second):
		agent.pendingMu.Lock()
		delete(agent.pending, requestID)
		agent.pendingMu.Unlock()
		return nil, fmt.Errorf("proxy request timed out")
	}
}

// startTCPListener starts a TCP listener for TCP tunnel forwarding
func (h *Hub) startTCPListener(agent *AgentConn, port int) {
	addr := fmt.Sprintf("0.0.0.0:%d", port)
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		log.Printf("[relay] Failed to listen on %s: %v", addr, err)
		return
	}

	h.tcpMu.Lock()
	h.tcpListeners[port] = ln
	h.tcpMu.Unlock()

	log.Printf("[relay] TCP listener started on port %d for tunnel %s", port, agent.TunnelID)

	for {
		conn, err := ln.Accept()
		if err != nil {
			log.Printf("[relay] TCP accept error on port %d: %v", port, err)
			return
		}

		go h.handleTCPConnection(agent, conn)
	}
}

func (h *Hub) handleTCPConnection(agent *AgentConn, tcpConn net.Conn) {
	defer tcpConn.Close()

	// For TCP tunnels, we send a special message to the agent to open a new stream
	requestID := fmt.Sprintf("tcp_%d", time.Now().UnixNano())

	agent.mu.Lock()
	err := agent.Conn.WriteJSON(models.ControlMessage{
		Type: "tcp_connect",
		Payload: map[string]string{
			"request_id": requestID,
			"remote_addr": tcpConn.RemoteAddr().String(),
		},
	})
	agent.mu.Unlock()

	if err != nil {
		log.Printf("[relay] Failed to signal TCP connect: %v", err)
		return
	}

	// For now, TCP tunneling through WebSocket uses a simplified approach:
	// Data is base64 encoded and sent as JSON messages
	// A production system would use yamux/smux for multiplexing
	log.Printf("[relay] TCP connection from %s to tunnel %s", tcpConn.RemoteAddr(), agent.TunnelID)
}

// Dashboard WebSocket support

func (h *Hub) HandleDashboardWS(w http.ResponseWriter, r *http.Request) {
	tokenStr := r.URL.Query().Get("token")
	if tokenStr == "" {
		http.Error(w, "missing token", http.StatusUnauthorized)
		return
	}

	claims, err := auth.ValidateToken(tokenStr)
	if err != nil {
		http.Error(w, "invalid token", http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	client := &DashClient{Conn: conn}

	h.dashMu.Lock()
	h.dashClients[claims.UserID] = append(h.dashClients[claims.UserID], client)
	h.dashMu.Unlock()

	log.Printf("[relay] Dashboard WS connected for user %s", claims.UserID)

	// Keep connection alive, remove on disconnect
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			h.dashMu.Lock()
			clients := h.dashClients[claims.UserID]
			for i, c := range clients {
				if c == client {
					h.dashClients[claims.UserID] = append(clients[:i], clients[i+1:]...)
					break
				}
			}
			h.dashMu.Unlock()
			conn.Close()
			return
		}
	}
}

func (h *Hub) BroadcastToUser(userID string, event models.RealtimeEvent) {
	h.dashMu.RLock()
	clients := h.dashClients[userID]
	h.dashMu.RUnlock()

	for _, client := range clients {
		client.WriteJSON(event)
	}
}

// GetActiveTunnels returns all active tunnels (for admin)
func (h *Hub) GetActiveTunnelCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.agents)
}

// IsAgentConnected checks if a specific tunnel has a connected agent
func (h *Hub) IsAgentConnected(tunnelID string) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	_, ok := h.agents[tunnelID]
	return ok
}
