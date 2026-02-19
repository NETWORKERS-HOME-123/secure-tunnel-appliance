# UltraSlim — Platform Documentation

> **Version:** 0.1  
> **Stack:** React 18 · TypeScript · Vite · Tailwind CSS · Lovable Cloud (Supabase)  
> **Last Updated:** February 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Authentication & Authorization](#authentication--authorization)
4. [Pages & Routes](#pages--routes)
5. [Components Reference](#components-reference)
6. [Hooks Reference](#hooks-reference)
7. [Database Schema](#database-schema)
8. [Edge Functions](#edge-functions)
9. [Real-time Features](#real-time-features)
10. [Security Model](#security-model)
11. [Theming](#theming)
12. [Configuration & Environment](#configuration--environment)

---

## Overview

UltraSlim is a production-grade tunnel management platform that allows authenticated users to create, monitor, and manage secure network tunnels (HTTP and TCP). It provides a full-featured dashboard with real-time monitoring, analytics, API key management, webhook integrations, and an admin panel for superadmins.

### Key Features

| Feature | Description |
|---|---|
| **Tunnel Management** | Create, monitor, and delete HTTP/TCP tunnels with configurable TTL |
| **Real-time Monitoring** | Live status updates via WebSocket subscriptions |
| **Analytics Dashboard** | Bandwidth charts, connection trends, and per-tunnel metrics |
| **Admin Panel** | Superadmin-only user and tunnel management |
| **API Key Management** | Generate/revoke SHA-256 hashed API keys for programmatic access |
| **Webhook Integrations** | Subscribe HTTPS endpoints to tunnel lifecycle events |
| **Notification Center** | Real-time notifications with unread badge and history |
| **Session Management** | View and revoke active sessions across devices |
| **Export/Import** | JSON-based tunnel configuration backup and restore |
| **Health Checks** | Per-tunnel health and latency monitoring |
| **Dark/Light Theme** | System-aware theme switching |
| **RBAC** | Role-based access control (user, admin, superadmin) |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Frontend (SPA)                │
│  React 18 · Vite · Tailwind · shadcn/ui        │
│                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐│
│  │ Pages    │ │Components│ │ Hooks            ││
│  │ (7)      │ │ (21+)    │ │ (6 custom)       ││
│  └──────────┘ └──────────┘ └──────────────────┘│
└──────────┬──────────────────────────────────────┘
           │ HTTPS / WSS
┌──────────▼──────────────────────────────────────┐
│              Lovable Cloud (Supabase)            │
│                                                  │
│  ┌────────┐ ┌──────────┐ ┌───────────────────┐  │
│  │Auth    │ │PostgreSQL│ │Edge Functions      │  │
│  │(JWT)   │ │(RLS)     │ │(admin-panel)       │  │
│  └────────┘ └──────────┘ └───────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ Realtime (WebSocket subscriptions)         │  │
│  │ - tunnels, notifications                   │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### Data Flow

1. **Control Plane**: REST API via Supabase client SDK
2. **Data Plane**: Persistent outbound multiplexed connections (WebSocket/TCP)
3. **Relay Model**: Single cloud relay forwards traffic without payload inspection

---

## Authentication & Authorization

### Auth Flow

| Flow | Route | Description |
|---|---|---|
| **Sign Up** | `/auth` | Email + password + display name; email verification required |
| **Sign In** | `/auth` | Email + password |
| **Forgot Password** | `/auth` | Sends password reset email |
| **Reset Password** | `/reset-password` | Handles recovery token and password update |

### Input Validation

All auth inputs are validated with **Zod** schemas:
- **Email**: `z.string().trim().email().max(255)`
- **Password**: `z.string().min(6).max(128)`

### Role-Based Access Control (RBAC)

Roles are stored in a dedicated `user_roles` table (never on profiles) to prevent privilege escalation.

| Role | Permissions |
|---|---|
| `user` | Default. CRUD own tunnels, view own data |
| `admin` | Extended access (reserved for future use) |
| `superadmin` | Full platform access. Manage all users, roles, and tunnels |

**Role checking** uses a `SECURITY DEFINER` function `has_role(_user_id, _role)` to avoid RLS recursion.

### Protected Routes

All dashboard routes are wrapped in `<ProtectedRoute>` which redirects unauthenticated users to `/auth`.

---

## Pages & Routes

| Route | Page Component | Access | Description |
|---|---|---|---|
| `/auth` | `Auth` | Public | Login, signup, forgot password |
| `/reset-password` | `ResetPassword` | Public | Password reset handler |
| `/` | `Index` | Authenticated | Main tunnel dashboard |
| `/analytics` | `Analytics` | Authenticated | Bandwidth and connection analytics |
| `/settings` | `Settings` | Authenticated | Profile, security, API keys, webhooks, health, config |
| `/admin` | `AdminPanel` | Superadmin | User and tunnel management |
| `/*` | `NotFound` | Public | 404 error page |

### Page Details

#### `/` — Tunnel Dashboard (Index)
- Displays real-time tunnel list with status indicators
- **AgentStatus** component shows live connection health
- **CreateTunnelDialog** for new tunnel creation with type, port, and TTL
- **SetupGuide** with CLI installation instructions
- Active tunnel count badge

#### `/analytics` — Analytics Dashboard
- **Stats Overview**: Total tunnels, active count, bandwidth in/out
- **Charts** (recharts): Bandwidth area chart, status/type pie charts
- **Connection Logs Table**: Recent requests with method, path, status code, latency

#### `/settings` — Settings (Tabbed)
| Tab | Features |
|---|---|
| **Profile** | Edit display name, view email, activity log |
| **Security** | Change password, session management, danger zone (sign out) |
| **API Keys** | Generate `usk_` prefixed keys, revoke, delete |
| **Webhooks** | Configure HTTPS endpoints for tunnel events |
| **Health** | Per-tunnel health checks with latency |
| **Config** | Export/import tunnel configurations as JSON |

#### `/admin` — Admin Panel (Superadmin Only)
- **Users Table**: All platform users with roles, tunnel counts, last sign-in
- **Role Management**: Assign/remove admin and superadmin roles inline
- **Tunnels Table**: All tunnels across the platform with owner, type, status, traffic
- **Actions**: Delete any tunnel, manage any user's roles
- Uses the `admin-panel` edge function with `SUPABASE_SERVICE_ROLE_KEY`

---

## Components Reference

### Layout Components

| Component | File | Description |
|---|---|---|
| `DashboardLayout` | `DashboardLayout.tsx` | Wraps pages in `SidebarProvider` + sticky header with trigger |
| `AppSidebar` | `AppSidebar.tsx` | Collapsible sidebar with nav links, notifications, theme toggle, sign out |
| `DashboardHeader` | `DashboardHeader.tsx` | Legacy header (replaced by sidebar layout) |
| `ErrorBoundary` | `ErrorBoundary.tsx` | Global React error boundary with crash recovery UI |
| `ProtectedRoute` | `ProtectedRoute.tsx` | Auth guard that redirects to `/auth` |

### Feature Components

| Component | File | Description |
|---|---|---|
| `TunnelCard` | `TunnelCard.tsx` | Individual tunnel display with status, metrics, copy endpoint, delete |
| `CreateTunnelDialog` | `CreateTunnelDialog.tsx` | Modal for creating tunnels (type, port, TTL selector) |
| `AgentStatus` | `AgentStatus.tsx` | Real-time agent connection status indicator |
| `SetupGuide` | `SetupGuide.tsx` | Collapsible CLI setup instructions |
| `NotificationCenter` | `NotificationCenter.tsx` | Sheet-based notification history with mark read/clear |
| `ThemeToggle` | `ThemeToggle.tsx` | Dark/light/system theme switcher dropdown |
| `ApiKeyManager` | `ApiKeyManager.tsx` | Full API key lifecycle (create, copy, revoke, delete) |
| `WebhookManager` | `WebhookManager.tsx` | Webhook CRUD with event selection and HTTPS validation |
| `SessionManager` | `SessionManager.tsx` | Sign out other devices / sign out everywhere |
| `ExportImportConfig` | `ExportImportConfig.tsx` | JSON export/import for tunnel configurations |
| `TunnelHealthChecks` | `TunnelHealthChecks.tsx` | Health status and latency per tunnel |
| `ConfirmDeleteDialog` | `ConfirmDeleteDialog.tsx` | Reusable confirmation dialog for destructive actions |

### UI Primitives

| Component | Description |
|---|---|
| `StatusBadge` | Tunnel online/offline status indicator |
| `TunnelTypeBadge` | HTTP/TCP type badge |
| `NavLink` | `forwardRef`-compatible navigation link with active state |

---

## Hooks Reference

| Hook | File | Returns | Description |
|---|---|---|---|
| `useTunnels` | `useTunnels.ts` | `{ tunnels, loading, createTunnel, deleteTunnel }` | Full tunnel CRUD with real-time subscription |
| `useProfile` | `useProfile.ts` | `{ profile, loading }` | Current user's profile data |
| `useRoles` | `useRoles.ts` | `{ roles, isSuperAdmin, isAdmin, loading }` | Current user's RBAC roles |
| `useNotifications` | `useNotifications.ts` | `{ notifications, unreadCount, markAsRead, markAllAsRead, clearAll }` | Real-time notification management |
| `useAuth` | (context) | `{ user, session, loading, signOut }` | Auth state from `AuthContext` |
| `useIsMobile` | `use-mobile.tsx` | `boolean` | Responsive breakpoint detection |

---

## Database Schema

### Tables

#### `profiles`
| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | UUID | `gen_random_uuid()` | PK |
| `user_id` | UUID | — | Unique, references auth.users |
| `display_name` | TEXT | NULL | |
| `avatar_url` | TEXT | NULL | |
| `max_tunnels` | INTEGER | `5` | Per-user tunnel limit |
| `created_at` | TIMESTAMPTZ | `now()` | |
| `updated_at` | TIMESTAMPTZ | `now()` | Auto-updated via trigger |

#### `tunnels`
| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | UUID | `gen_random_uuid()` | PK |
| `user_id` | UUID | — | Owner |
| `tunnel_id` | TEXT | `'tn_' \|\| substr(md5(random()), 1, 8)` | Human-readable ID |
| `type` | ENUM | `'http'` | `http` or `tcp` |
| `local_port` | INTEGER | — | Target port on client |
| `public_endpoint` | TEXT | — | Public URL or TCP address |
| `status` | ENUM | `'online'` | `online` or `offline` |
| `bytes_in` | BIGINT | `0` | Inbound traffic |
| `bytes_out` | BIGINT | `0` | Outbound traffic |
| `connections` | INTEGER | `0` | Connection count |
| `expires_at` | TIMESTAMPTZ | NULL | Optional TTL |
| `created_at` | TIMESTAMPTZ | `now()` | |
| `updated_at` | TIMESTAMPTZ | `now()` | Auto-updated via trigger |

#### `user_roles`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | Unique constraint with role |
| `role` | ENUM | `user`, `admin`, `superadmin` |
| `created_at` | TIMESTAMPTZ | |

#### `audit_logs`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | Actor |
| `action` | TEXT | e.g. `tunnel.created`, `tunnel.deleted` |
| `target_type` | TEXT | e.g. `tunnel` |
| `target_id` | TEXT | Target entity ID |
| `metadata` | JSONB | Additional context |
| `ip_address` | TEXT | Optional |
| `created_at` | TIMESTAMPTZ | |

#### `connection_logs`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `tunnel_id` | UUID | FK to tunnels |
| `user_id` | UUID | Owner |
| `source_ip` | TEXT | Client IP |
| `method` | TEXT | HTTP method |
| `path` | TEXT | Request path |
| `status_code` | INTEGER | Response status |
| `latency_ms` | INTEGER | Response time |
| `bytes_transferred` | BIGINT | Request size |
| `created_at` | TIMESTAMPTZ | |

#### `notifications`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | Recipient |
| `title` | TEXT | Notification title |
| `message` | TEXT | Notification body |
| `type` | TEXT | `info`, `warning`, `success` |
| `read` | BOOLEAN | Default `false` |
| `metadata` | JSONB | Additional data |
| `created_at` | TIMESTAMPTZ | |

#### `api_keys`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | Owner |
| `name` | TEXT | Human label |
| `key_prefix` | TEXT | First 8 chars + `...` |
| `key_hash` | TEXT | SHA-256 hash of full key |
| `last_used_at` | TIMESTAMPTZ | Last API call |
| `expires_at` | TIMESTAMPTZ | Optional expiry |
| `revoked` | BOOLEAN | Default `false` |
| `created_at` | TIMESTAMPTZ | |

#### `webhooks`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | Owner |
| `name` | TEXT | Label |
| `url` | TEXT | HTTPS endpoint |
| `events` | TEXT[] | Subscribed events |
| `secret` | TEXT | Signing secret (`whsec_...`) |
| `active` | BOOLEAN | Default `true` |
| `last_triggered_at` | TIMESTAMPTZ | |
| `failure_count` | INTEGER | Consecutive failures |
| `created_at` | TIMESTAMPTZ | |

### Database Functions

| Function | Type | Description |
|---|---|---|
| `has_role(_user_id, _role)` | SQL, SECURITY DEFINER | Check if user has a specific role |
| `check_tunnel_limit()` | Trigger function | Enforces per-user tunnel limit from `profiles.max_tunnels` |
| `log_tunnel_audit()` | Trigger function | Auto-creates audit log entries on tunnel INSERT/DELETE |
| `notify_tunnel_change()` | Trigger function | Creates notifications on tunnel INSERT, status UPDATE, DELETE |
| `handle_new_user()` | Trigger function | Auto-creates profile on auth.users INSERT |
| `update_updated_at_column()` | Trigger function | Auto-updates `updated_at` timestamp |

---

## Edge Functions

### `admin-panel`

**Path:** `supabase/functions/admin-panel/index.ts`  
**JWT Verification:** Manual (set `verify_jwt = false` in config.toml)  
**Auth:** Validates JWT manually, checks `superadmin` role via service role client

| Action | Method | Query Param | Body | Description |
|---|---|---|---|---|
| `users` | GET | `?action=users` | — | List all users with profiles, roles, tunnels |
| `delete-tunnel` | POST | `?action=delete-tunnel` | `{ tunnel_id }` | Delete any tunnel |
| `assign-role` | POST | `?action=assign-role` | `{ user_id, role }` | Assign role to user |
| `remove-role` | POST | `?action=remove-role` | `{ user_id, role }` | Remove role (can't remove own superadmin) |

---

## Real-time Features

| Channel | Table | Events | Used In |
|---|---|---|---|
| `tunnels-realtime` | `tunnels` | INSERT, UPDATE, DELETE | `useTunnels` hook |
| `notifications-realtime` | `notifications` | INSERT | `useNotifications` hook |
| `agent-status` | `tunnels` | * | `AgentStatus` component |

---

## Security Model

### Row-Level Security (RLS)

All tables have RLS enabled. Policies follow the principle of least privilege:

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | Own only | Own only | Own only | ❌ |
| `tunnels` | Own only | Own only | Own only | Own only |
| `user_roles` | Own only | Superadmin | Superadmin | Superadmin |
| `audit_logs` | Own + Superadmin | Own only | ❌ | ❌ |
| `connection_logs` | Own + Superadmin | Own only | ❌ | ❌ |
| `notifications` | Own only | Own only | Own only | Own only |
| `api_keys` | Own only | Own only | Own only | Own only |
| `webhooks` | Own only | Own only | Own only | Own only |

### Security Features

- **API Keys**: Stored as SHA-256 hashes; raw key shown once on creation
- **Webhook Secrets**: Auto-generated `whsec_` signing secrets for payload verification
- **Input Validation**: Zod schemas on all user inputs (client-side)
- **CORS**: Configured in edge functions with explicit header allowlist
- **Rate Limiting**: Database-level tunnel limit (default 5) via trigger
- **Confirmation Dialogs**: All destructive actions require confirmation

---

## Theming

### Design Tokens

The app uses HSL-based CSS custom properties defined in `src/index.css`:

| Mode | Background | Primary | Accent |
|---|---|---|---|
| **Light** | `0 0% 98%` | `152 76% 38%` (green) | `185 60% 42%` (teal) |
| **Dark** | `220 20% 7%` | `152 76% 52%` (green) | `185 70% 50%` (teal) |

### Theme Switching

Powered by `next-themes` with `ThemeProvider`:
- **Modes**: `light`, `dark`, `system`
- **Default**: `dark`
- **Storage**: `localStorage`
- **Attribute**: `class` on `<html>`

### Typography

- **Sans**: Inter
- **Mono**: JetBrains Mono (used for IDs, endpoints, badges)

### Custom Utilities

| Class | Description |
|---|---|
| `.glow-primary` | Green box shadow glow |
| `.glow-accent` | Teal box shadow glow |
| `.text-glow` | Green text shadow |
| `.border-glow` | Subtle green border glow |
| `.grid-bg` | Subtle grid background pattern |

---

## Configuration & Environment

### Environment Variables (auto-managed)

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Backend API URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon/public key |
| `VITE_SUPABASE_PROJECT_ID` | Project identifier |

### Edge Function Secrets

| Secret | Description |
|---|---|
| `SUPABASE_URL` | Backend URL (server-side) |
| `SUPABASE_ANON_KEY` | Anon key for JWT validation |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin operations (bypasses RLS) |
| `LOVABLE_API_KEY` | AI gateway access |

### Config Files

| File | Purpose |
|---|---|
| `supabase/config.toml` | Edge function settings (`verify_jwt = false`) |
| `tailwind.config.ts` | Tailwind theme extensions |
| `tsconfig.app.json` | TypeScript paths (`@/` alias) |
| `vite.config.ts` | Vite build configuration |

---

## Development Notes

### Tunnel ID Format
- Pattern: `tn_` + 8 random alphanumeric chars
- Example: `tn_a3f8k2m1`

### API Key Format
- Pattern: `usk_` + 40 random alphanumeric chars
- Stored as SHA-256 hash; prefix `usk_XXXX...` shown in UI
- Example: `usk_ABcDeFgHiJkLmNoPqRsTuVwXyZ1234567890abcd`

### Webhook Secret Format
- Pattern: `whsec_` + UUID without dashes
- Example: `whsec_a1b2c3d4e5f6789012345678abcdef01`

### Public Endpoint Generation
- **HTTP**: `https://{slug}-{tunnel_suffix}.ultraslim.io`
- **TCP**: `tcp://relay.ultraslim.io:{40000-49999}`

---

*This documentation is auto-generated and reflects the current state of the UltraSlim platform codebase.*
