# UltraSlim - Complete Documentation Guide

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Quick Start User Guide](#3-quick-start-user-guide)
4. [CLI Client Reference](#4-cli-client-reference)
5. [Dashboard User Guide](#5-dashboard-user-guide)
6. [API Reference](#6-api-reference)
7. [Backend Documentation](#7-backend-documentation)
8. [Frontend Documentation](#8-frontend-documentation)
9. [Deployment & Infrastructure](#9-deployment--infrastructure)
10. [Admin Guide](#10-admin-guide)
11. [Troubleshooting](#11-troubleshooting)
12. [Security](#12-security)

---

## 1. Project Overview

UltraSlim is a self-hosted, ngrok-style secure tunneling platform that exposes local services to the internet through a relay server. It provides HTTP, TCP, SSH, RDP, UDP, and WebSocket tunneling with a real-time dashboard, CLI client, REST API, and team collaboration features.

### Key Features

- **Multi-protocol tunneling** - HTTP, TCP, SSH, RDP, UDP, WebSocket
- **Real-time dashboard** - Live tunnel status, bandwidth, connection monitoring
- **CLI client** - Simple command-line tunnel creation
- **REST API** - Programmatic access with API key authentication
- **Webhooks** - Event notifications (tunnel created, deleted, online, offline)
- **Team workspaces** - Invite members, shared tunnel management
- **Admin panel** - User management, role assignment, platform oversight
- **Analytics** - Bandwidth charts, connection logs, request inspection
- **Auto-TLS** - Let's Encrypt certificates via Caddy

### Technology Stack

| Layer | Technology |
|---|---|
| Backend | Go 1.22 (net/http, gorilla/websocket) |
| Database | PostgreSQL 16 |
| Frontend | React 18, TypeScript 5, Vite 5, Tailwind CSS |
| Reverse Proxy | Caddy 2 (auto HTTPS) |
| Auth | JWT (HS256, 72h expiry), bcrypt passwords |
| Real-time | WebSocket (control plane + dashboard) |
| OS | Ubuntu 24.04 LTS |
| Hosting | DigitalOcean (BLR1, s-1vcpu-2gb) |

---

## 2. Architecture

### System Architecture Diagram

```
                         Cloudflare DNS
                              |
              21tunnel.com
              *.21tunnel.com
                              |
                         Caddy (TLS)
                         :80 / :443
                        /          \
               Main Domain      Wildcard Subdomains
                   |                    |
          Go Server :8080        Go Proxy :8081
          (API + SPA)          (Tunnel Relay)
                   |                    |
              PostgreSQL          WebSocket Hub
                :5432            (Agent Conns)
                                       |
                              TCP Listeners
                             :10000-:20000
```

### Data Flow - HTTP Tunnel

```
1. CLI connects to wss://21tunnel.com/ws/agent
2. CLI sends: { type: "register", payload: { token, local_port, type: "http" } }
3. Server assigns tunnel ID (e.g. tn_abc123) and public endpoint
4. Server responds: { type: "registered", payload: { tunnel_id, public_endpoint } }

5. External request hits: https://tn_abc123.21tunnel.com/path
6. Caddy forwards to Go proxy (:8081)
7. Go proxy finds agent for tn_abc123
8. Go proxy sends via WebSocket: { type: "proxy_request", payload: { method, path, headers, body } }
9. CLI forwards to localhost:{port}
10. CLI sends response back via WebSocket: { type: "proxy_response", payload: { status, headers, body } }
11. Go proxy writes response to original HTTP client
```

### Database Schema (8 tables)

| Table | Purpose | Key Fields |
|---|---|---|
| `users` | User accounts | id, email, password_hash, role, max_tunnels |
| `tunnels` | Tunnel records | id, user_id, tunnel_id, type, status, bytes_in/out |
| `api_keys` | API authentication | id, user_id, key_hash, key_prefix, revoked |
| `webhooks` | Event webhooks | id, user_id, url, events[], secret, active |
| `notifications` | User notifications | id, user_id, title, message, type, read |
| `audit_logs` | Action audit trail | id, user_id, action, target_type, target_id |
| `connection_logs` | HTTP request logs | id, tunnel_id, method, path, status_code, latency_ms |

### Go Backend Package Structure

```
backend/
  go.mod
  cmd/
    server/main.go       # API server entry point (ports 8080 + 8081)
    cli/main.go           # CLI client binary
  internal/
    models/models.go      # All data structs and request/response types
    config/config.go      # Environment variable loading
    db/db.go              # PostgreSQL connection, migrations (8 tables)
    auth/auth.go          # JWT, bcrypt, API key generation
    middleware/middleware.go # Auth, CORS, JSON, superadmin middleware
    relay/relay.go        # WebSocket hub, agent connections, HTTP proxy, TCP listeners
    api/api.go            # All REST API handlers (30+ endpoints)
```

### Frontend Structure

```
tunnel-buddy-main/src/
  App.tsx                   # Router + provider stack
  main.tsx                  # React entry point
  pages/                    # 11 page components
    Index.tsx               # Dashboard (tunnel list)
    Auth.tsx                # Login / Signup / Forgot Password
    Landing.tsx             # Public marketing page
    Settings.tsx            # 8-tab settings page
    Analytics.tsx           # Charts, logs, request inspector
    AdminPanel.tsx          # User + tunnel management (superadmin)
    Docs.tsx                # Markdown documentation viewer
    StatusPage.tsx          # System health + incidents
    ResetPassword.tsx       # Password reset form
    ApiDocsPage.tsx         # API reference for developers
    NotFound.tsx            # 404 page
  components/               # 25+ feature components + 30+ UI primitives
    DashboardLayout.tsx     # Main layout with sidebar
    TunnelCard.tsx          # Individual tunnel display card
    CreateTunnelDialog.tsx  # Tunnel creation dialog
    ApiKeyManager.tsx       # API key CRUD
    WebhookManager.tsx      # Webhook CRUD + delivery logs
    TeamManager.tsx         # Team workspace management
    SubdomainManager.tsx    # Custom subdomain claiming
    SessionManager.tsx      # Active session management
    RequestInspector.tsx    # HTTP request detail viewer
    NotificationCenter.tsx  # Notification bell + dropdown
    ...
    ui/                     # ShadCN primitives (button, dialog, table, ...)
  hooks/
    useTunnels.ts           # Tunnel data + WebSocket real-time
    useProfile.ts           # User profile data
    useRoles.ts             # Role checking (admin, superadmin)
    useActiveSection.ts     # Landing page scroll tracking
  contexts/
    AuthContext.tsx          # Global auth state (user, token, signOut)
  lib/
    api.ts                  # REST API client (all endpoints)
    utils.ts                # Tailwind class merge utility
    utils-format.ts         # formatBytes, formatRelativeTime
```

---

## 3. Quick Start User Guide

### Step 1: Access the Dashboard

Open your browser and navigate to:

```
https://21tunnel.com
```

### Step 2: Create an Account

1. Click **Sign Up** on the login page
2. Enter your display name, email, and password (min 6 characters)
3. Click **Create Account**
4. You are automatically logged in and redirected to the dashboard

### Step 3: Create Your First Tunnel

UltraSlim tunnels are created using the CLI client. From the dashboard, you will see a **Setup Guide** with instructions.

#### Install the CLI

Download the CLI binary from the server:
```bash
# On the server, the CLI is at /opt/ultraslim/bin/ultraslim
# Copy it to your local machine or build it locally:
cd backend && go build -o ultraslim ./cmd/cli
```

#### Login with the CLI

```bash
ultraslim login --email you@example.com --password yourpassword
```

Or use an API key (create one from Dashboard > Settings > API Keys):
```bash
ultraslim login --api-key usk_your_api_key_here
```

#### Start a Tunnel

Expose a local web server on port 3000:
```bash
ultraslim connect 3000
```

Output:
```
+========================================================+
|                UltraSlim Tunnel Active                  |
+========================================================+
|  Tunnel ID:  tn_a1b2c3d4                               |
|  Forwarding: https://tn_a1b2c3d4.21tunnel.com -> localhost:3000 |
|  Type:       http                                      |
+========================================================+
|  Press Ctrl+C to disconnect                            |
+========================================================+
```

### Step 4: Share Your URL

Share the public URL with anyone:
```
https://tn_a1b2c3d4.21tunnel.com
```

All requests to this URL are forwarded to your local machine in real-time.

### Step 5: Monitor in the Dashboard

Return to the dashboard at `https://21tunnel.com` to see:
- Your tunnel listed with **online** status
- Real-time bandwidth counters
- Connection count
- The **Analytics** page shows detailed request logs

### Step 6: Disconnect

Press `Ctrl+C` in the CLI to disconnect the tunnel. It will automatically show as **offline** in the dashboard.

---

## 4. CLI Client Reference

### Installation

The CLI binary is built from `backend/cmd/cli/main.go`. Build for your platform:

```bash
# Linux
GOOS=linux GOARCH=amd64 go build -o ultraslim ./cmd/cli

# macOS
GOOS=darwin GOARCH=amd64 go build -o ultraslim ./cmd/cli

# Windows
GOOS=windows GOARCH=amd64 go build -o ultraslim.exe ./cmd/cli
```

### Commands

#### `ultraslim login`

Authenticate with the UltraSlim server.

```bash
# Interactive login
ultraslim login --email user@example.com --password yourpassword

# Login with API key
ultraslim login --api-key usk_xxxxxxxxxxxxxxxxxxxx

# Login to a specific server
ultraslim login --server https://21tunnel.com --email user@example.com

# Flags:
#   --email     Account email
#   --password  Account password
#   --api-key   API key (alternative to email/password)
#   --server    Server URL (default: https://21tunnel.com)
```

Configuration is saved to `~/.ultraslim/config.json`.

#### `ultraslim connect <port>`

Create a tunnel to a local service.

```bash
# HTTP tunnel (default)
ultraslim connect 3000

# TCP tunnel
ultraslim connect 5432 --type tcp

# SSH tunnel
ultraslim connect 22 --type ssh

# RDP tunnel
ultraslim connect 3389 --type rdp

# WebSocket tunnel
ultraslim connect 8080 --type ws

# Flags:
#   --type   Tunnel type: http, tcp, ssh, rdp, udp, ws (default: http)
```

**HTTP tunnels** get a subdomain: `https://tn_xxxx.21tunnel.com`
**TCP tunnels** get a port: `21tunnel.com:10001`

Traffic is logged with color-coded status codes in the terminal:
```
  GET    /api/users                200    12ms    1.2KB
  POST   /api/data                 201    45ms    256B
  GET    /missing                  404     3ms    128B
```

#### `ultraslim status`

Show all your tunnels and their status.

```bash
ultraslim status

# Output:
# TUNNEL ID    TYPE     STATUS     ENDPOINT                                         PORT
# --------------------------------------------------------------------------------
# tn_a1b2c3d4  http     online     https://tn_a1b2c3d4.21tunnel.com    3000
# tn_e5f6g7h8  tcp      offline    21tunnel.com:10001                  5432
```

#### `ultraslim config`

Display current CLI configuration.

```bash
ultraslim config

# Output:
# Server URL: https://21tunnel.com
# Email:      user@example.com
# Token:      eyJhbG...175o
# API Key:    (not set)
# Config:     /home/user/.ultraslim/config.json
```

#### `ultraslim version`

Print version information.

```bash
ultraslim version
# ultraslim CLI v1.0.0 (linux/amd64)
```

### Configuration File

Location: `~/.ultraslim/config.json`

```json
{
  "server_url": "https://21tunnel.com",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "api_key": "",
  "email": "user@example.com"
}
```

---

## 5. Dashboard User Guide

### Dashboard (Home Page)

The main dashboard at `/` shows all your tunnels.

**Features:**
- **Tunnel list** - Each tunnel shows: ID, type badge, status, endpoint, bandwidth, connections
- **Search** - Filter tunnels by name
- **Filters** - Filter by status (online/offline) and type (HTTP/TCP/SSH/etc)
- **Usage quota** - Shows how many tunnels you have used vs your limit
- **Create button** - Shows the CLI command needed to create a tunnel
- **Setup guide** - First-time instructions for new users

**Tunnel Card Information:**
- Tunnel ID (e.g. `tn_a1b2c3d4`)
- Type badge (HTTP, TCP, SSH, etc)
- Status indicator (green = online, red = offline)
- Public endpoint (click to copy)
- Bandwidth: bytes in / bytes out
- Connection count
- Delete button

### Settings Page

Access via the sidebar or `/settings`. Contains 8 tabs:

#### Profile Tab
- Edit your display name
- View your email
- View recent activity (audit log of your actions)

#### Security Tab
- **Change password** - Set a new password
- **Two-factor authentication** - Set up 2FA with an authenticator app
- **Session management** - See active sessions, sign out other devices
- **Sign out all devices** - Nuclear option to end all sessions

#### API Keys Tab
- **Create API key** - Generate a key with optional expiration date
- **Key format** - Keys start with `usk_` prefix (e.g. `usk_8821d10f...`)
- **Copy key** - One-time copy opportunity (key is only shown once)
- **Delete key** - Revoke a key permanently
- Use API keys for CLI login or programmatic API access

#### Webhooks Tab
- **Create webhook** - Set a URL and select events to subscribe to
- **Available events**: `tunnel.created`, `tunnel.deleted`, `tunnel.online`, `tunnel.offline`
- **Webhook secret** - Auto-generated `whsec_` prefixed secret for payload signing
- **Toggle active** - Enable/disable individual webhooks
- **Delivery log** - View delivery attempts, status codes, retry failures

#### Subdomains Tab
- **Claim subdomain** - Reserve a custom subdomain for your tunnels
- **Link to tunnel** - Associate a subdomain with a specific tunnel
- **Release** - Give up a claimed subdomain

#### Teams Tab
- **Create team** - Set up a workspace for collaboration
- **Invite members** - Add team members by email
- **View members** - See team roster and roles
- **Delete team** - Remove the team workspace

#### Health Tab
- **Tunnel health checks** - View health and latency for each tunnel
- **Status indicators** - Healthy (green), degraded (yellow), down (red)

#### Config Tab
- **Export configuration** - Download your tunnel configuration as JSON
- **Import configuration** - Restore settings from a backup file

### Analytics Page

Access via the sidebar or `/analytics`. Two tabs: **Overview** and **Request Inspector**.

#### Overview Tab
- **Stats cards** - Total tunnels, active count, bandwidth in, bandwidth out
- **Bandwidth chart** - Area chart showing bytes in/out per tunnel
- **Tunnel breakdown** - Pie charts for status (online/offline) and type (HTTP/TCP)
- **Recent connections** - Table of the last 50 requests with method, path, status, latency, time
- **Export** - Download connection logs as CSV

#### Request Inspector Tab
- Select a tunnel to inspect
- View individual HTTP requests with full details
- Filter by method, status code, time range

### Status Page

Public page at `/status` showing platform health.

- **Overall status** - Operational or degraded
- **Component status** - Relay server, Dashboard, API, Auth system
- **Active incidents** - Any ongoing issues with severity badges
- **Resolved incidents** - Recent resolved issues
- Auto-refreshes every 30 seconds

---

## 6. API Reference

### Base URL

```
https://21tunnel.com/api
```

### Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

Obtain a token via the login endpoint.

Alternatively, API keys can be used with the CLI but not directly with REST endpoints (they are for WebSocket agent auth only).

### Public Endpoints

#### POST /api/auth/signup

Create a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "display_name": "John Doe"
}
```

**Response (201):**
```json
{
  "token": "eyJhbG...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "display_name": "John Doe",
    "max_tunnels": 5,
    "role": "user",
    "created_at": "2026-02-18T18:53:57Z",
    "updated_at": "2026-02-18T18:53:57Z"
  }
}
```

#### POST /api/auth/login

Authenticate and receive a JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response (200):**
```json
{
  "token": "eyJhbG...",
  "user": { ... }
}
```

#### POST /api/auth/forgot-password

Request a password reset (always returns success to prevent email enumeration).

**Request:**
```json
{
  "email": "user@example.com"
}
```

#### POST /api/auth/reset-password

Reset password with email verification.

**Request:**
```json
{
  "email": "user@example.com",
  "new_password": "newpassword123"
}
```

#### GET /api/health

Public health check endpoint.

**Response (200):**
```json
{
  "status": "healthy",
  "database": true,
  "active_agents": 2,
  "total_users": 15,
  "online_tunnels": 3,
  "uptime": "48h23m12s",
  "version": "1.0.0"
}
```

### Protected Endpoints (require Bearer token)

#### Profile

| Method | Path | Description |
|---|---|---|
| GET | `/api/profile` | Get current user profile |
| PATCH | `/api/profile` | Update display_name, avatar_url |

#### Tunnels

| Method | Path | Description |
|---|---|---|
| GET | `/api/tunnels` | List all your tunnels |
| DELETE | `/api/tunnels/{id}` | Delete a tunnel by UUID |
| GET | `/api/tunnels/{id}/health` | Check tunnel health and latency |

**GET /api/tunnels Response:**
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "tunnel_id": "tn_a1b2c3d4",
    "type": "http",
    "local_port": 3000,
    "public_endpoint": "https://tn_a1b2c3d4.21tunnel.com",
    "status": "online",
    "bytes_in": 15234,
    "bytes_out": 89012,
    "connections": 42,
    "assigned_port": 0,
    "expires_at": null,
    "created_at": "2026-02-18T19:00:00Z",
    "updated_at": "2026-02-18T19:05:00Z"
  }
]
```

#### API Keys

| Method | Path | Description |
|---|---|---|
| GET | `/api/api-keys` | List all API keys |
| POST | `/api/api-keys` | Create a new API key |
| DELETE | `/api/api-keys/{id}` | Delete an API key |

**POST /api/api-keys Request:**
```json
{
  "name": "my-ci-key",
  "expires_at": "2027-01-01T00:00:00Z"
}
```

**Response (201):**
```json
{
  "api_key": {
    "id": "uuid",
    "user_id": "uuid",
    "name": "my-ci-key",
    "key_prefix": "usk_8821d10f...",
    "revoked": false,
    "created_at": "2026-02-18T19:00:00Z"
  },
  "key": "usk_8821d10faeb8d091ece37f1274e03933630b3d712c53299fcc43ccfe74b28185"
}
```

> **Note:** The full key is only returned once at creation time. Store it securely.

#### Webhooks

| Method | Path | Description |
|---|---|---|
| GET | `/api/webhooks` | List all webhooks |
| POST | `/api/webhooks` | Create a webhook |
| PATCH | `/api/webhooks/{id}` | Update webhook (toggle active) |
| DELETE | `/api/webhooks/{id}` | Delete a webhook |

**POST /api/webhooks Request:**
```json
{
  "name": "deploy-hook",
  "url": "https://myapp.com/webhook",
  "events": ["tunnel.created", "tunnel.online"]
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "name": "deploy-hook",
  "url": "https://myapp.com/webhook",
  "events": ["tunnel.created", "tunnel.online"],
  "secret": "whsec_041bbe1c4ff512c5c6d6c16273aa6112597b41c854b988ad",
  "active": true,
  "failure_count": 0,
  "created_at": "2026-02-18T19:00:00Z"
}
```

#### Notifications

| Method | Path | Description |
|---|---|---|
| GET | `/api/notifications` | Get last 50 notifications |
| PATCH | `/api/notifications/{id}/read` | Mark one notification as read |
| POST | `/api/notifications/read-all` | Mark all notifications as read |
| DELETE | `/api/notifications` | Clear all notifications |

#### Analytics

| Method | Path | Description |
|---|---|---|
| GET | `/api/analytics` | Get bandwidth statistics |
| GET | `/api/analytics/connections` | Get connection logs (last 100) |

#### Config

| Method | Path | Description |
|---|---|---|
| GET | `/api/config/export` | Export tunnel configuration as JSON |

#### Auth Token

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/refresh` | Refresh JWT token (requires valid token) |

### Admin Endpoints (require superadmin role)

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/users` | List all platform users |
| POST | `/api/admin/roles` | Assign role to a user |
| GET | `/api/admin/tunnels` | List all tunnels across platform |
| DELETE | `/api/admin/tunnels/{id}` | Delete any tunnel |
| GET | `/api/admin/audit-logs` | View platform-wide audit logs |

**POST /api/admin/roles Request:**
```json
{
  "user_id": "uuid-of-user",
  "role": "admin"
}
```

Valid roles: `user`, `admin`, `superadmin`

### WebSocket Endpoints

#### GET /ws/agent

CLI agent connection endpoint. Used by the CLI to register tunnels and relay traffic.

**Registration message:**
```json
{
  "type": "register",
  "payload": {
    "token": "jwt_token_here",
    "local_port": 3000,
    "type": "http"
  }
}
```

**Successful registration response:**
```json
{
  "type": "registered",
  "payload": {
    "tunnel_id": "tn_a1b2c3d4",
    "public_endpoint": "https://tn_a1b2c3d4.21tunnel.com",
    "assigned_port": 0
  }
}
```

**Proxy request (server -> agent):**
```json
{
  "type": "proxy_request",
  "payload": {
    "request_id": "req_1234567890",
    "method": "GET",
    "path": "/api/data",
    "headers": { "Accept": "application/json" },
    "body": ""
  }
}
```

**Proxy response (agent -> server):**
```json
{
  "type": "proxy_response",
  "payload": {
    "request_id": "req_1234567890",
    "status_code": 200,
    "headers": { "Content-Type": "application/json" },
    "body": "base64_encoded_response_body"
  }
}
```

#### GET /ws/realtime?token=JWT_TOKEN

Dashboard real-time updates. Receives events when tunnels change.

**Event format:**
```json
{
  "event": "INSERT",
  "table": "tunnels",
  "data": null
}
```

Events trigger the dashboard to refresh tunnel data automatically.

---

## 7. Backend Documentation

### Go Packages

#### `internal/models`

All data structures for the application. Contains:

**Database models:** User, Tunnel, APIKey, Webhook, Notification, AuditLog, ConnectionLog

**Request types:** LoginRequest, SignupRequest, CreateTunnelRequest, CreateAPIKeyRequest, CreateWebhookRequest, UpdateProfileRequest, AssignRoleRequest

**Response types:** AuthResponse, CreateAPIKeyResponse

**Relay protocol:** ControlMessage, RegisterTunnelPayload, TunnelRegisteredPayload, ProxyRequestPayload, ProxyResponsePayload, RealtimeEvent

**Analytics:** BandwidthStats

#### `internal/config`

Loads configuration from environment variables:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | API server port |
| `DATABASE_URL` | postgres://ultraslim:... | PostgreSQL connection string |
| `JWT_SECRET` | (required) | HMAC-SHA256 signing key |
| `DOMAIN` | 21tunnel.com | Main domain |
| `TUNNEL_DOMAIN` | 21tunnel.com | Tunnel subdomain parent |
| `TCP_PORT_MIN` | `10000` | First TCP tunnel port |
| `TCP_PORT_MAX` | `20000` | Last TCP tunnel port |

#### `internal/db`

- `Init(databaseURL)` - Opens PostgreSQL connection pool (25 max, 5 idle, 5m lifetime)
- `Migrate()` - Creates all 8 tables and indexes if they don't exist
- `Close()` - Closes the database connection

#### `internal/auth`

- `Init(secret)` - Sets the JWT signing key
- `HashPassword(password)` - bcrypt hash with default cost
- `CheckPassword(hash, password)` - bcrypt comparison
- `GenerateToken(userID, email, role)` - JWT with 72-hour expiry
- `ValidateToken(tokenStr)` - Parse and validate JWT, returns Claims
- `GenerateAPIKey()` - Returns (full_key, prefix, sha256_hash)
- `HashAPIKey(key)` - SHA-256 hash for lookup
- `GenerateWebhookSecret()` - Generates `whsec_` prefixed secret
- `GenerateTunnelID()` - Generates `tn_` prefixed ID (8 hex chars)

#### `internal/middleware`

- `AuthMiddleware(next)` - Validates Bearer token, injects Claims into context
- `GetClaims(r)` - Extracts Claims from request context
- `CORSMiddleware(next)` - Sets CORS headers (Allow-Origin: *)
- `JSONMiddleware(next)` - Sets Content-Type: application/json
- `SuperadminMiddleware(next)` - Requires role = "superadmin"

#### `internal/relay`

The core tunnel relay engine.

**Hub** - Central connection manager:
- `NewHub(domain, tcpMin, tcpMax)` - Creates the relay hub
- `HandleAgentConnect(w, r)` - WebSocket upgrade for CLI agents
- `HandleDashboardWS(w, r)` - WebSocket for dashboard real-time
- `GetAgent(tunnelID)` - Look up connected agent
- `GetAgentBySubdomain(host)` - Extract tunnel ID from host header
- `ProxyHTTPRequest(agent, r)` - Forward HTTP request through WebSocket
- `BroadcastToUser(userID, event)` - Send real-time event to dashboard

**AgentConn** - Individual agent connection:
- Manages WebSocket connection to CLI client
- Handles pending proxy requests with response channels
- 30-second ping/pong keepalive
- 60-second read deadline
- Automatic cleanup on disconnect (DB update, notifications, audit log)

**TCP Tunneling:**
- `allocateTCPPort()` - Atomic port allocation from pool
- `startTCPListener(agent, port)` - Starts TCP listener for non-HTTP tunnels

#### `internal/api`

All REST API handlers. See [API Reference](#6-api-reference) for endpoints.

Key handlers:
- `HandleSignup` / `HandleLogin` - User authentication
- `HandleGetTunnels` - Lists tunnels with live agent status check
- `HandleTunnelProxy` - HTTP reverse proxy through WebSocket agents
- `HandleSystemHealth` - Platform health check
- `HandleAdminGetUsers` - Admin user listing with tunnel counts

### Server Entry Point (`cmd/server/main.go`)

1. Loads config from environment
2. Initializes auth module with JWT secret
3. Connects to PostgreSQL and runs migrations
4. Creates default superadmin if none exists
5. Initializes the relay hub
6. Registers all HTTP routes on `http.ServeMux`
7. Starts tunnel proxy server on :8081
8. Starts main API + SPA server on :8080
9. Serves React SPA from `./static/` directory

### SPA Handler

The `spaHandler` serves the React build:
- Static files from `./static/` directory
- All non-API, non-WS, non-file requests serve `index.html` (for client-side routing)

---

## 8. Frontend Documentation

### Authentication Flow

1. User visits `/auth` page
2. Submits login form -> `api.auth.login(email, password)`
3. On success, token and user stored in localStorage
4. `AuthContext` updates, `ProtectedRoute` allows dashboard access
5. Token auto-validated on page load via `api.profile.get()`
6. On 401 response, token cleared, redirect to `/auth`
7. Multi-tab logout via `storage` event listener

### Real-time Updates

The `useTunnels` hook establishes a WebSocket connection:
1. Calls `api.connectRealtime(callback)` with JWT token
2. WebSocket connects to `wss://21tunnel.com/ws/realtime?token=...`
3. On tunnel events (INSERT/UPDATE/DELETE), callback triggers state refresh
4. Auto-reconnects after 5 seconds on disconnect

### Route Protection

`ProtectedRoute` component wraps authenticated pages:
- Checks `useAuth()` for user presence
- While loading, shows spinner
- If no user, redirects to `/auth`
- Admin panel additionally checks `useRoles().isSuperAdmin`

### State Management

- **Auth state** - React Context (`AuthContext`)
- **Server data** - TanStack Query with 30s stale time
- **Tunnel data** - Custom `useTunnels` hook with WebSocket
- **Form state** - React Hook Form + Zod validation
- **UI state** - Component-local useState
- **Theme** - next-themes (persisted in localStorage)

### Key Components Detail

#### TunnelCard

Displays a single tunnel with all metadata. Features:
- Color-coded status badge (green/red)
- Type badge (HTTP/TCP/SSH/RDP/UDP/WS)
- Click-to-copy public endpoint
- Bandwidth display (formatted with `formatBytes`)
- Delete with confirmation dialog
- Expiration countdown if TTL set

#### ApiKeyManager

Full CRUD for API keys:
- Lists keys with prefix display and last-used timestamp
- Create form with name input and optional date picker
- One-time key display after creation (copy button)
- Delete with confirmation

#### WebhookManager

Full webhook lifecycle:
- Create with URL input and multi-select event picker
- Active toggle switch
- Delivery log viewer (expandable per webhook)
- Secret display with copy button

#### NotificationCenter

Bell icon in the header with notification dropdown:
- Unread count badge
- Notification list with type icons
- Mark individual as read
- Mark all read / Clear all buttons
- Real-time updates via WebSocket

---

## 9. Deployment & Infrastructure

### Server Details

| Property | Value |
|---|---|
| Droplet Name | ultraslim-relay |
| Droplet ID | 552748819 |
| IP Address | 139.59.93.230 |
| Region | BLR1 (Bangalore) |
| OS | Ubuntu 24.04 LTS |
| Size | s-1vcpu-2gb (1 vCPU, 2GB RAM) |
| Storage | 50GB SSD |

### DNS Configuration

Configure in Cloudflare:

| Record | Type | Name | Value | Proxy |
|---|---|---|---|---|
| A | A | tunnel | 139.59.93.230 | DNS Only |
| A | A | *.tunnel | 139.59.93.230 | DNS Only |

### File Locations

```
/opt/ultraslim/
  bin/
    ultraslim-server       # Go server binary
    ultraslim              # CLI binary
    static/                # React SPA build (index.html, assets/)
  src/
    backend/               # Go source code
  frontend/                # React source code
  backups/                 # PostgreSQL daily backups
  go/                      # GOPATH
  .cache/                  # Go build cache

/etc/systemd/system/ultraslim.service   # systemd unit
/etc/caddy/Caddyfile                    # Caddy reverse proxy config
/etc/logrotate.d/ultraslim              # Log rotation
/etc/cron.d/ultraslim-backup            # Backup cron
/root/.pgpass                           # PostgreSQL auth for backups
```

### Service Management

```bash
# Server
systemctl status ultraslim       # Check status
systemctl restart ultraslim      # Restart
systemctl stop ultraslim         # Stop
journalctl -u ultraslim -f       # Live logs
journalctl -u ultraslim -n 100   # Last 100 log lines

# Caddy (reverse proxy)
systemctl status caddy
systemctl restart caddy
journalctl -u caddy -f

# PostgreSQL
systemctl status postgresql
sudo -u postgres psql ultraslim  # Connect to DB

# Firewall
ufw status                       # Show rules
```

### Ports

| Port | Service | Access |
|---|---|---|
| 22 | SSH | Admin only |
| 80 | Caddy HTTP | Public (redirects to HTTPS) |
| 443 | Caddy HTTPS | Public |
| 5432 | PostgreSQL | localhost only |
| 8080 | Go API + SPA | Via Caddy only |
| 8081 | Go Tunnel Proxy | Via Caddy only |
| 10000-20000 | TCP Tunnels | Public |

### Backup Strategy

- **PostgreSQL** - Daily dump at 3:00 AM to `/opt/ultraslim/backups/`
- **Retention** - 30 days, older backups auto-deleted
- **Format** - `db-YYYYMMDD.sql.gz` (gzip compressed)

Manual backup:
```bash
pg_dump -U ultraslim ultraslim | gzip > /opt/ultraslim/backups/manual-$(date +%Y%m%d).sql.gz
```

Restore from backup:
```bash
gunzip -c /opt/ultraslim/backups/db-20260218.sql.gz | sudo -u postgres psql ultraslim
```

### Rebuilding

To rebuild the backend after code changes:
```bash
cd /opt/ultraslim/src/backend
/usr/local/go/bin/go build -o /opt/ultraslim/bin/ultraslim-server ./cmd/server
/usr/local/go/bin/go build -o /opt/ultraslim/bin/ultraslim ./cmd/cli
chown ultraslim:ultraslim /opt/ultraslim/bin/ultraslim-server /opt/ultraslim/bin/ultraslim
systemctl restart ultraslim
```

To rebuild the frontend:
```bash
cd /opt/ultraslim/frontend
npm run build
cp -r dist/* /opt/ultraslim/bin/static/
chown -R ultraslim:ultraslim /opt/ultraslim/bin/static/
```

---

## 10. Admin Guide

### Default Admin Account

```
Email:    admin@ultraslim.dev
Password: UltraSlim@2026!
Role:     superadmin
```

**Change this password immediately after first login** via Settings > Security > Change Password.

### Admin Panel

Access at `/admin` (requires superadmin role).

#### User Management

- View all registered users with email, roles, tunnel count, last sign-in
- **Assign roles**: Click the role dropdown next to a user
  - `user` - Standard account (default 5 tunnels)
  - `admin` - Extended privileges
  - `superadmin` - Full platform access
- **Remove roles**: Click a role badge to remove it
- Cannot remove your own superadmin role

#### Tunnel Management

- View all tunnels across the entire platform
- See owner email, type, endpoint, status, traffic stats
- Delete any tunnel (also disconnects the agent)

#### Audit Logs

Available at `/api/admin/audit-logs`:
- All user actions with timestamps
- Action types: tunnel.created, tunnel.deleted, tunnel.offline
- IP addresses and target resources

### Role Permissions

| Feature | user | admin | superadmin |
|---|---|---|---|
| Create tunnels | 5 max | 5 max | 100 max |
| View own tunnels | Yes | Yes | Yes |
| Manage API keys | Yes | Yes | Yes |
| Manage webhooks | Yes | Yes | Yes |
| View own analytics | Yes | Yes | Yes |
| Access admin panel | No | No | Yes |
| Manage users | No | No | Yes |
| Delete any tunnel | No | No | Yes |
| Assign roles | No | No | Yes |
| View audit logs | No | No | Yes |

### Database Administration

Connect to PostgreSQL:
```bash
sudo -u postgres psql ultraslim
```

Common queries:
```sql
-- Count users by role
SELECT role, COUNT(*) FROM users GROUP BY role;

-- Active tunnels
SELECT tunnel_id, type, public_endpoint, status FROM tunnels WHERE status = 'online';

-- Top users by bandwidth
SELECT u.email, SUM(t.bytes_in + t.bytes_out) as total_bytes
FROM users u JOIN tunnels t ON t.user_id = u.id
GROUP BY u.email ORDER BY total_bytes DESC LIMIT 10;

-- Recent audit activity
SELECT u.email, al.action, al.target_type, al.target_id, al.created_at
FROM audit_logs al JOIN users u ON u.id = al.user_id
ORDER BY al.created_at DESC LIMIT 20;

-- Increase a user's tunnel limit
UPDATE users SET max_tunnels = 20 WHERE email = 'user@example.com';
```

---

## 11. Troubleshooting

### Server Won't Start

**Check logs:**
```bash
journalctl -u ultraslim -n 50 --no-pager
```

**Common issues:**

| Error | Cause | Fix |
|---|---|---|
| `failed to connect to database` | PostgreSQL not running | `systemctl start postgresql` |
| `failed to ping database` | Wrong DATABASE_URL | Check `/etc/systemd/system/ultraslim.service` |
| `bind: address already in use` | Port 8080 already taken | `lsof -i :8080` and kill the process |
| `permission denied` | Wrong file ownership | `chown -R ultraslim:ultraslim /opt/ultraslim` |

### Caddy Certificate Issues

**Check Caddy logs:**
```bash
journalctl -u caddy -n 50 --no-pager
```

**Common issues:**

| Error | Cause | Fix |
|---|---|---|
| ACME challenge failed | DNS not pointing to server | Verify A record for 21tunnel.com |
| on-demand TLS error | Caddyfile misconfigured | Use `http://` prefix for wildcard domains |
| rate limited | Too many cert requests | Wait 1 hour, check rate limits |

### Tunnel Not Connecting

1. **Check CLI auth:** `ultraslim config` - verify token is present
2. **Check server URL:** Ensure `server_url` is `https://21tunnel.com`
3. **Check WebSocket:** The CLI connects to `wss://21tunnel.com/ws/agent`
4. **Check firewall:** Ensure port 443 is accessible from client
5. **Check tunnel limit:** Users get 5 tunnels max by default

### Dashboard Not Loading

1. **Check static files exist:** `ls /opt/ultraslim/bin/static/index.html`
2. **Check Caddy is running:** `systemctl status caddy`
3. **Check Go server is running:** `systemctl status ultraslim`
4. **Clear browser cache** and try incognito mode

### Database Issues

**Reset the database (WARNING: deletes all data):**
```bash
sudo -u postgres psql -c "DROP DATABASE ultraslim;"
sudo -u postgres psql -c "CREATE DATABASE ultraslim OWNER ultraslim;"
systemctl restart ultraslim   # Migrations run on startup
```

**Check connection count:**
```bash
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'ultraslim';"
```

### Performance Issues

**Check memory:**
```bash
free -h
```

**Check disk:**
```bash
df -h /opt/ultraslim
```

**Check active connections:**
```bash
# Connected WebSocket agents
curl -s http://localhost:8080/api/health | python3 -m json.tool
```

**Restart everything:**
```bash
systemctl restart postgresql
systemctl restart ultraslim
systemctl restart caddy
```

---

## 12. Security

### Authentication Security

- **Passwords** - bcrypt hashed with default cost (10 rounds)
- **JWT tokens** - HS256 signed, 72-hour expiry
- **API keys** - SHA-256 hashed, `usk_` prefix, only shown once at creation
- **Webhook secrets** - `whsec_` prefix, cryptographically random

### Network Security

- **UFW firewall** - Default deny incoming, only specific ports open
- **fail2ban** - Enabled for SSH brute-force protection
- **TLS** - Let's Encrypt via Caddy (auto-renewal)
- **CORS** - Configured to allow cross-origin requests

### Service Security

- **Go server runs as `ultraslim` user** (not root)
- **systemd hardening**: NoNewPrivileges, ProtectSystem=strict, ProtectHome=yes
- **PostgreSQL** - Local connections only, password auth
- **File permissions** - 600 for config, 700 for directories

### Recommendations for Production Hardening

1. **Change default admin password** immediately after deployment
2. **Rotate JWT secret** periodically by updating `JWT_SECRET` in the service file
3. **Enable Cloudflare proxy** for DDoS protection on the main domain
4. **Set up monitoring** with DigitalOcean Monitoring or external services
5. **Enable DigitalOcean backups** ($2.40/mo) for full droplet snapshots
6. **Review audit logs** regularly via the admin panel
7. **Set up alerts** for disk space, memory, and CPU usage
8. **Update packages** regularly: `apt update && apt upgrade`
9. **Restrict CORS** to your specific domain in production
10. **Consider rate limiting** on auth endpoints to prevent brute-force attacks
