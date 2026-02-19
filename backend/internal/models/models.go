package models

import (
	"time"
)

type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	DisplayName  string    `json:"display_name"`
	AvatarURL    string    `json:"avatar_url,omitempty"`
	MaxTunnels   int       `json:"max_tunnels"`
	Role         string    `json:"role"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type Tunnel struct {
	ID             string     `json:"id"`
	UserID         string     `json:"user_id"`
	TunnelID       string     `json:"tunnel_id"`
	Type           string     `json:"type"`
	LocalPort      int        `json:"local_port"`
	PublicEndpoint string     `json:"public_endpoint"`
	Status         string     `json:"status"`
	BytesIn        int64      `json:"bytes_in"`
	BytesOut       int64      `json:"bytes_out"`
	Connections    int        `json:"connections"`
	AssignedPort   int        `json:"assigned_port,omitempty"`
	ExpiresAt      *time.Time `json:"expires_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type APIKey struct {
	ID        string     `json:"id"`
	UserID    string     `json:"user_id"`
	Name      string     `json:"name"`
	KeyPrefix string     `json:"key_prefix"`
	KeyHash   string     `json:"-"`
	LastUsed  *time.Time `json:"last_used_at,omitempty"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	Revoked   bool       `json:"revoked"`
	CreatedAt time.Time  `json:"created_at"`
}

type Webhook struct {
	ID            string     `json:"id"`
	UserID        string     `json:"user_id"`
	Name          string     `json:"name"`
	URL           string     `json:"url"`
	Events        []string   `json:"events"`
	Secret        string     `json:"secret,omitempty"`
	Active        bool       `json:"active"`
	LastTriggered *time.Time `json:"last_triggered_at,omitempty"`
	FailureCount  int        `json:"failure_count"`
	CreatedAt     time.Time  `json:"created_at"`
}

type Notification struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Title     string    `json:"title"`
	Message   string    `json:"message"`
	Type      string    `json:"type"`
	Read      bool      `json:"read"`
	CreatedAt time.Time `json:"created_at"`
}

type AuditLog struct {
	ID         string    `json:"id"`
	UserID     string    `json:"user_id"`
	Action     string    `json:"action"`
	TargetType string    `json:"target_type"`
	TargetID   string    `json:"target_id"`
	Metadata   string    `json:"metadata,omitempty"`
	IPAddress  string    `json:"ip_address,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

type ConnectionLog struct {
	ID               string    `json:"id"`
	TunnelID         string    `json:"tunnel_id"`
	UserID           string    `json:"user_id"`
	SourceIP         string    `json:"source_ip"`
	Method           string    `json:"method"`
	Path             string    `json:"path"`
	StatusCode       int       `json:"status_code"`
	LatencyMs        int       `json:"latency_ms"`
	BytesTransferred int64     `json:"bytes_transferred"`
	CreatedAt        time.Time `json:"created_at"`
}

// Auth types

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type SignupRequest struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	DisplayName string `json:"display_name"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type CreateTunnelRequest struct {
	Type      string `json:"type"`
	LocalPort int    `json:"local_port"`
	TTLHours  int    `json:"ttl_hours,omitempty"`
}

type CreateAPIKeyRequest struct {
	Name      string `json:"name"`
	ExpiresAt string `json:"expires_at,omitempty"`
}

type CreateAPIKeyResponse struct {
	APIKey APIKey `json:"api_key"`
	Key    string `json:"key"`
}

type CreateWebhookRequest struct {
	Name   string   `json:"name"`
	URL    string   `json:"url"`
	Events []string `json:"events"`
}

type UpdateProfileRequest struct {
	DisplayName string `json:"display_name,omitempty"`
	AvatarURL   string `json:"avatar_url,omitempty"`
}

type AssignRoleRequest struct {
	UserID string `json:"user_id"`
	Role   string `json:"role"`
}

// Relay protocol messages

type ControlMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload,omitempty"`
}

type RegisterTunnelPayload struct {
	APIKey    string `json:"api_key,omitempty"`
	Token     string `json:"token,omitempty"`
	LocalPort int    `json:"local_port"`
	Type      string `json:"type"`
}

type TunnelRegisteredPayload struct {
	TunnelID       string `json:"tunnel_id"`
	PublicEndpoint string `json:"public_endpoint"`
	AssignedPort   int    `json:"assigned_port,omitempty"`
}

type ProxyRequestPayload struct {
	RequestID string            `json:"request_id"`
	Method    string            `json:"method"`
	Path      string            `json:"path"`
	Headers   map[string]string `json:"headers"`
	Body      string            `json:"body,omitempty"`
}

type ProxyResponsePayload struct {
	RequestID  string            `json:"request_id"`
	StatusCode int               `json:"status_code"`
	Headers    map[string]string `json:"headers"`
	Body       string            `json:"body,omitempty"`
}

// Dashboard real-time message
type RealtimeEvent struct {
	Event string      `json:"event"`
	Table string      `json:"table"`
	Data  interface{} `json:"data"`
}

// Analytics
type BandwidthStats struct {
	TotalTunnels  int   `json:"total_tunnels"`
	ActiveTunnels int   `json:"active_tunnels"`
	TotalBytesIn  int64 `json:"total_bytes_in"`
	TotalBytesOut int64 `json:"total_bytes_out"`
}
