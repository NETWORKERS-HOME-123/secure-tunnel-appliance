# UltraSlim — Backend Architecture & Build Guide

> **Version:** 0.1  
> **Audience:** Backend engineers building on UltraSlim  
> **Last Updated:** February 2026

---

## 1. Current Backend Stack

### Infrastructure Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Lovable Cloud (Supabase)                      │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────┐  │
│  │   Auth        │  │  PostgreSQL  │  │   Edge Functions (Deno)    │  │
│  │              │  │              │  │                            │  │
│  │  JWT tokens  │  │  8 tables    │  │  admin-panel               │  │
│  │  Email/pass  │  │  6 functions │  │  (future: relay-control,   │  │
│  │  Recovery    │  │  4 triggers  │  │   billing-webhook,         │  │
│  │              │  │  RLS on all  │  │   health-monitor)          │  │
│  └──────────────┘  └──────────────┘  └────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │  Realtime Engine (WebSocket)                                     ││
│  │  Channels: tunnels-realtime, notifications-realtime              ││
│  └──────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Database Schema Deep Dive

### Entity Relationship Diagram

```
auth.users (managed)
    │
    ├──1:1──▶ profiles
    │             │
    ├──1:N──▶ tunnels ──1:N──▶ connection_logs
    │
    ├──1:N──▶ user_roles
    │
    ├──1:N──▶ audit_logs
    │
    ├──1:N──▶ notifications
    │
    ├──1:N──▶ api_keys
    │
    └──1:N──▶ webhooks
```

### Table Details

#### profiles
- **Purpose:** Extended user data beyond auth.users
- **Auto-created:** Via `handle_new_user()` trigger on auth.users INSERT
- **Key field:** `max_tunnels` (default 5) — enforced by `check_tunnel_limit()` trigger

#### tunnels
- **Purpose:** Core entity representing active/inactive tunnels
- **ID generation:** `tunnel_id` = `tn_` + 8 random hex chars (database default)
- **Triggers:**
  - `check_tunnel_limit()` — BEFORE INSERT, enforces per-user limit
  - `log_tunnel_audit()` — AFTER INSERT/DELETE, creates audit trail
  - `notify_tunnel_change()` — AFTER INSERT/UPDATE/DELETE, creates notifications
  - `update_updated_at_column()` — BEFORE UPDATE, timestamps

#### connection_logs
- **Purpose:** Per-request logging for analytics
- **FK:** `tunnel_id` → tunnels.id
- **Indexed columns:** `tunnel_id`, `user_id`, `created_at`

#### api_keys
- **Security model:**
  - Raw key: `usk_` + 40 random chars (shown once on creation)
  - Stored: SHA-256 hash of full key
  - Display: `key_prefix` shows first 8 chars + `...`
  - Revocation: `revoked` boolean flag (soft delete)

#### webhooks
- **Event types:** `tunnel.created`, `tunnel.deleted`, `tunnel.status_changed`
- **Secret format:** `whsec_` + UUID (no dashes)
- **Failure tracking:** `failure_count` increments on delivery failure
- **Validation:** URL must be HTTPS

---

## 3. Database Functions & Triggers

### Function: `has_role(_user_id, _role)`

```sql
-- SECURITY DEFINER: Runs with owner privileges to bypass RLS
-- Used in RLS policies to check roles without recursion
SELECT EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = _user_id AND role = _role
)
```

**Why SECURITY DEFINER:** RLS policies on `user_roles` check `auth.uid()`. If an RLS policy on another table calls `has_role()`, it would trigger RLS on `user_roles`, creating infinite recursion. `SECURITY DEFINER` bypasses this.

### Function: `check_tunnel_limit()`

```sql
-- BEFORE INSERT trigger on tunnels
-- Reads max_tunnels from profiles, defaults to 5
-- Raises exception if limit reached
```

### Function: `notify_tunnel_change()`

```sql
-- AFTER INSERT/UPDATE/DELETE trigger on tunnels
-- Creates notification records for:
--   INSERT → "Tunnel Created" (success)
--   UPDATE (status change) → "Tunnel Online/Offline" (success/warning)
--   DELETE → "Tunnel Deleted" (info)
```

### Function: `log_tunnel_audit()`

```sql
-- AFTER INSERT/DELETE trigger on tunnels
-- Creates audit_logs entries with metadata:
--   INSERT → type, local_port, public_endpoint
--   DELETE → tunnel_id
```

---

## 4. Row-Level Security (RLS) Policies

### Policy Matrix

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| profiles | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | ❌ |
| tunnels | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` |
| user_roles | `auth.uid() = user_id` | `has_role(superadmin)` | `has_role(superadmin)` | `has_role(superadmin)` |
| audit_logs | `auth.uid() = user_id OR has_role(superadmin)` | `auth.uid() = user_id` | ❌ | ❌ |
| connection_logs | `auth.uid() = user_id OR has_role(superadmin)` | `auth.uid() = user_id` | ❌ | ❌ |
| notifications | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` |
| api_keys | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` |
| webhooks | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` |

### Security Considerations

1. **No foreign key to auth.users** — profiles references `user_id` without FK constraint to avoid cross-schema issues
2. **Superadmin checks** — Always use `has_role()` function, never direct table query in policies
3. **Immutable audit logs** — No UPDATE or DELETE policies on audit_logs/connection_logs
4. **Profile deletion blocked** — No DELETE policy on profiles to prevent orphan auth records

---

## 5. Edge Functions

### Current: `admin-panel`

**Path:** `supabase/functions/admin-panel/index.ts`  
**Auth:** Manual JWT verification (verify_jwt = false in config.toml)  
**Client:** Service role client (bypasses RLS)

| Endpoint | Action | Auth | Description |
|---|---|---|---|
| `GET ?action=users` | List users | Superadmin JWT | Returns all users with profiles, roles, tunnel counts |
| `POST ?action=delete-tunnel` | Delete tunnel | Superadmin JWT | Deletes any tunnel by ID |
| `POST ?action=assign-role` | Assign role | Superadmin JWT | Adds role to user |
| `POST ?action=remove-role` | Remove role | Superadmin JWT | Removes role (can't remove own superadmin) |

### Planned Edge Functions

#### `relay-control`
**Purpose:** Control plane for CLI agent communication

```typescript
// Planned endpoints:
POST /connect     — Agent registers with API key, receives relay assignment
POST /heartbeat   — Agent sends periodic health check
POST /disconnect  — Agent graceful shutdown
GET  /tunnels     — Agent fetches its tunnel configurations
```

#### `billing-webhook`
**Purpose:** Handle Stripe webhook events

```typescript
// Planned events:
checkout.session.completed    — Provision paid tier
customer.subscription.updated — Update limits
customer.subscription.deleted — Downgrade to free
invoice.payment_failed        — Send warning notification
```

#### `health-monitor`
**Purpose:** Scheduled health checks on active tunnels

```typescript
// Planned behavior:
// Runs every 60 seconds via pg_cron or external scheduler
// Pings each active tunnel's public endpoint
// Updates tunnel status on failure
// Creates notification on status change
```

#### `webhook-dispatcher`
**Purpose:** Deliver webhook events to user-configured endpoints

```typescript
// Planned behavior:
// Triggered by tunnel lifecycle events (via pg_notify or direct call)
// Signs payload with user's webhook secret (HMAC-SHA256)
// Retries with exponential backoff (max 3 attempts)
// Increments failure_count on persistent failures
// Deactivates webhook after 10 consecutive failures
```

---

## 6. Realtime Configuration

### Active Channels

```sql
-- Tunnels: Full realtime for INSERT, UPDATE, DELETE
ALTER PUBLICATION supabase_realtime ADD TABLE public.tunnels;

-- Notifications: INSERT only (new notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
```

### Client Subscription Patterns

```typescript
// Tunnel updates — filtered by user_id
supabase.channel('tunnels-realtime')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'tunnels',
    filter: `user_id=eq.${userId}`
  }, handler)
  .subscribe()

// Notifications — filtered by user_id, INSERT only
supabase.channel('notifications-realtime')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${userId}`
  }, handler)
  .subscribe()
```

---

## 7. API Key Authentication Flow

### For Future API/CLI Access

```
CLI Agent                          Edge Function                    Database
─────────                          ─────────────                    ────────
                                                                   
1. ultraslim login                                                 
   → User creates API key in dashboard                             
   → Raw key shown once: usk_ABC...XYZ                             
   → SHA-256 hash stored ─────────────────────────────────────────▶ api_keys.key_hash
                                                                   
2. ultraslim up --port 3000                                        
   → Sends: Authorization: Bearer usk_ABC...XYZ                   
                                   ← Receives key ────────────────
                                   → SHA-256(key) ────────────────▶ SELECT WHERE key_hash = ?
                                   ← Match found ◀────────────────
                                   → Check: revoked = false        
                                   → Check: expires_at > now()     
                                   → Update: last_used_at = now()  
                                   → Return: user_id, permissions  
```

---

## 8. Relay Server Architecture (To Build)

### Component Design

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloud Relay Server (Go)                    │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │ HTTP Server   │  │ TCP Listener │  │ Agent Manager      │ │
│  │ (port 443)   │  │ (40000-49999)│  │                    │ │
│  │              │  │              │  │ - Auth via API key  │ │
│  │ TLS term     │  │ Raw TCP      │  │ - WebSocket conn   │ │
│  │ Host routing │  │ Port mapping │  │ - Heartbeat check  │ │
│  │ Reverse proxy│  │ Bidirectional│  │ - Reconnect logic  │ │
│  └──────┬───────┘  └──────┬───────┘  └────────┬───────────┘ │
│         │                  │                    │             │
│         └──────────────────┴────────────────────┘             │
│                            │                                  │
│                    ┌───────▼───────┐                          │
│                    │ Multiplexer   │                          │
│                    │               │                          │
│                    │ Maps requests │                          │
│                    │ to agent      │                          │
│                    │ connections   │                          │
│                    └───────────────┘                          │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │ Rate Limiter │  │ Metrics      │  │ Config Store       │ │
│  │ (per-user)   │  │ (Prometheus) │  │ (Redis/Postgres)   │ │
│  └──────────────┘  └──────────────┘  └────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Language | Go | Best-in-class networking primitives, goroutine per connection |
| Transport | WebSocket (agent ↔ relay) | NAT traversal, HTTP/2 compatible, firewall friendly |
| Multiplexing | yamux or smux | Lightweight stream multiplexing over single WebSocket |
| TLS | autocert (Let's Encrypt) | Zero-config HTTPS for all tunnel subdomains |
| Routing | Host header matching | Map `slug.ultraslim.io` → specific agent connection |
| Health | TCP + HTTP health checks | Detect dead agents within 30 seconds |
| Scaling | Horizontal (stateless relay) | Any relay can serve any tunnel via shared state |

### Data Flow: HTTP Tunnel

```
Browser                    Relay                          Agent                   Local App
───────                    ─────                          ─────                   ─────────
GET myapp.ultraslim.io ──▶ 
                           Extract Host header
                           Look up tunnel by slug
                           Find agent WebSocket ──────▶
                                                        Receive multiplexed request
                                                        Forward to localhost:3000 ──────▶
                                                                                        Process
                                                        ◀────── HTTP response ──────────
                           ◀────── Response via WS ────
◀────── HTTP response ────
```

---

## 9. Environment & Secrets

### Current Secrets (Auto-Managed)

| Secret | Scope | Usage |
|---|---|---|
| `SUPABASE_URL` | Edge functions | Backend API URL |
| `SUPABASE_ANON_KEY` | Edge functions | Public/anon access |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge functions | Admin operations (bypasses RLS) |
| `SUPABASE_DB_URL` | Edge functions | Direct database connection |
| `SUPABASE_PUBLISHABLE_KEY` | Frontend | Client SDK initialization |
| `LOVABLE_API_KEY` | Edge functions | AI gateway access |

### Future Secrets Needed

| Secret | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Billing API calls |
| `STRIPE_WEBHOOK_SECRET` | Verify Stripe webhook signatures |
| `RELAY_SIGNING_KEY` | Sign relay-to-dashboard communications |
| `SENTRY_DSN` | Error tracking |

---

## 10. Building New Edge Functions

### Template

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create authenticated client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Your logic here
    const result = { message: "Hello", userId: user.id };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

### Directory Structure

```
supabase/
├── config.toml              # Function-level settings (verify_jwt, etc.)
└── functions/
    ├── admin-panel/
    │   └── index.ts          # Existing: superadmin operations
    ├── relay-control/        # Planned: agent communication
    │   └── index.ts
    ├── billing-webhook/      # Planned: Stripe events
    │   └── index.ts
    ├── health-monitor/       # Planned: tunnel health checks
    │   └── index.ts
    └── webhook-dispatcher/   # Planned: deliver user webhooks
        └── index.ts
```

---

*This guide is maintained for backend engineers contributing to UltraSlim. For frontend documentation, see DOCUMENTATION.md.*
