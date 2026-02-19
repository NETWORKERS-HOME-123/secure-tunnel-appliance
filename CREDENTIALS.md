# UltraSlim - Live Credentials & Access

**Status**: ✅ Production Ready
**Last Updated**: February 19, 2026

---

## 🌐 Production URL

```
https://21tunnel.com
```

---

## 👤 Test Accounts

### Admin Account
```
Email:       admin@ultraslim.dev
Password:    TestPass123!
Role:        Superadmin
Permissions: Full access to all features
Max Tunnels: 100
```

### Regular User Account
```
Email:       user@ultraslim.dev
Password:    TestPass123!
Role:        User
Permissions: Create/manage own tunnels
Max Tunnels: 5
```

---

## 🔐 API Access Examples

### 1. Login & Get JWT Token

```bash
curl -X POST https://21tunnel.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@ultraslim.dev",
    "password": "TestPass123!"
  }' | jq '.'
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "admin@ultraslim.dev",
    "display_name": "Admin User",
    "role": "superadmin"
  }
}
```

### 2. Use Token for Protected Requests

```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Get your profile
curl https://21tunnel.com/api/profile \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# List your tunnels
curl https://21tunnel.com/api/tunnels \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Get server analytics
curl https://21tunnel.com/api/analytics \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

### 3. Create an API Key

```bash
TOKEN="your-jwt-token-here"

curl -X POST https://21tunnel.com/api/api-keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"my-api-key"}' | jq '.api_key'
```

**Response:**
```json
{
  "id": "uuid-here",
  "key": "usk_your64charhexstring",
  "key_prefix": "usk_...",
  "created_at": "2026-02-19T10:00:00Z"
}
```

---

## 🔄 Token Refresh

JWT tokens expire after **72 hours**.

To get a new token without logging in again:

```bash
TOKEN="your-current-token"

curl -X POST https://21tunnel.com/api/auth/refresh \
  -H "Authorization: Bearer $TOKEN" | jq '.token'
```

---

## 🔑 Password Reset

Forgot your password? Use the secure token-based reset:

### Step 1: Request Password Reset
```bash
curl -X POST https://21tunnel.com/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ultraslim.dev"}'
```

Response: `{"message": "If an account with that email exists, a reset link has been sent."}`

**Note**: A reset token will be generated and should be sent via email in production. For testing, check server logs.

### Step 2: Reset Password with Token
```bash
curl -X POST https://21tunnel.com/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "64-character-hex-token-from-email",
    "new_password": "NewPassword123!"
  }'
```

**Important**:
- Token expires after **15 minutes**
- Token can only be used **once**
- Requires exact 64-character hex token

---

## 📊 Health Check

```bash
# Check if server is healthy
curl https://21tunnel.com/api/health | jq '.'
```

**Response:**
```json
{
  "status": "healthy",
  "uptime_seconds": 3600,
  "version": "1.0.0"
}
```

---

## 📝 Create Your Account

To create a new user account:

```bash
curl -X POST https://21tunnel.com/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePassword123!",
    "display_name": "New User"
  }' | jq '.'
```

**Requirements**:
- Email must be unique
- Password minimum 6 characters
- Rate limited: 5 requests per minute per IP

---

## 🧪 Rate Limiting

The following endpoints are rate-limited per IP:

| Endpoint | Limit | Burst | Window |
|----------|-------|-------|--------|
| `/api/auth/login` | 10 | 5 | 1 minute |
| `/api/auth/signup` | 5 | 3 | 1 minute |
| `/api/auth/forgot-password` | 3 | 2 | 1 hour |
| `/api/auth/reset-password` | 3 | 2 | 1 hour |
| `/ws/agent` | 20 | 5 | 1 minute |

**When you hit the limit:**
```json
{
  "error": "rate limit exceeded"
}
```

HTTP Status: `429 Too Many Requests`

---

## 🔌 WebSocket Connections

### Agent WebSocket
```
wss://21tunnel.com/ws/agent
```

**Connect with:**
```bash
wscat -c "wss://21tunnel.com/ws/agent"
```

### Dashboard Real-time WebSocket
```
wss://21tunnel.com/ws/realtime?token=JWT_TOKEN
```

---

## 📚 API Endpoints Summary

### Auth Endpoints (Public)
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Get JWT token
- `POST /api/auth/forgot-password` - Request reset token
- `POST /api/auth/reset-password` - Reset with token

### Protected Endpoints (Require JWT)
- `GET /api/profile` - Your profile
- `PATCH /api/profile` - Update profile
- `POST /api/auth/refresh` - Get new token
- `GET /api/tunnels` - List tunnels
- `DELETE /api/tunnels/{id}` - Delete tunnel
- `GET /api/api-keys` - List API keys
- `POST /api/api-keys` - Create API key
- `DELETE /api/api-keys/{id}` - Delete API key
- `GET /api/webhooks` - List webhooks
- `POST /api/webhooks` - Create webhook
- `PATCH /api/webhooks/{id}` - Update webhook
- `DELETE /api/webhooks/{id}` - Delete webhook
- `GET /api/notifications` - Get notifications
- `POST /api/notifications/read-all` - Mark all as read
- `DELETE /api/notifications` - Delete all notifications
- `GET /api/analytics` - Server analytics
- `GET /api/analytics/connections` - Connection logs

### Admin Endpoints (Require JWT + Superadmin Role)
- `GET /api/admin/users` - List all users
- `POST /api/admin/roles` - Assign roles
- `GET /api/admin/audit-logs` - View audit logs
- `GET /api/config/export` - Export configuration

---

## 🌍 CORS & Origins

**Allowed Origins** (configurable via `ALLOWED_ORIGINS` env var):
```
https://21tunnel.com
```

All API calls from other origins will receive:
```
Access-Control-Allow-Origin: <origin>
```

Only if `<origin>` matches the allowlist.

---

## 🔒 Security Notes

1. **JWT Token Security**
   - Tokens expire after 72 hours
   - Do NOT share tokens
   - Treat like password

2. **Password Reset Security**
   - Tokens expire after 15 minutes
   - Tokens are one-time use only
   - Requires secure cryptographic generation

3. **Rate Limiting**
   - Per-IP based on X-Forwarded-For header
   - Protects against brute-force attacks
   - Distributed across all public endpoints

4. **CORS Restriction**
   - Only specified origins allowed
   - Prevents unauthorized cross-origin requests
   - Environment-configurable

---

## 🛠️ Troubleshooting

### "Invalid credentials" on login
```bash
# Verify account exists and password is correct
# Test with: admin@ultraslim.dev / TestPass123!

# If still failing, check:
# 1. Email spelling
# 2. Password case-sensitivity
# 3. Account not locked/deleted
```

### "rate limit exceeded"
```bash
# You've made too many requests from this IP
# Solution: Wait 1 minute for login/signup
#          Wait 1 hour for password reset
# Or:     Use a different IP address
```

### "invalid or expired token"
```bash
# Token has expired (72 hour window)
# Solution: Login again to get fresh token
#
# OR token format incorrect
# Solution: Verify "Bearer TOKEN" format
```

### "invalid or expired reset token"
```bash
# Reset token expired (15 minute window)
# Solution: Request new forgot-password
#
# OR token already used
# Solution: Request new forgot-password
```

---

## 💡 Quick Curl Cheatsheet

```bash
# Save token to variable
TOKEN=$(curl -s -X POST https://21tunnel.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ultraslim.dev","password":"TestPass123!"}' \
  | jq -r '.token')

echo "Token: $TOKEN"

# Use in requests
curl https://21tunnel.com/api/profile \
  -H "Authorization: Bearer $TOKEN"

# Refresh token
curl -X POST https://21tunnel.com/api/auth/refresh \
  -H "Authorization: Bearer $TOKEN"

# Create API key
curl -X POST https://21tunnel.com/api/api-keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"key"}'
```

---

## 📞 Support

- **Status Page**: https://21tunnel.com/api/health
- **API Reference**: See SETUP_GUIDE.md
- **Quick Start**: See QUICK_START.md
- **Full Docs**: See README.md

---

## ✨ You're Ready!

1. ✅ Accounts are live and ready
2. ✅ All endpoints are functional
3. ✅ Rate limiting is active
4. ✅ Security hardening is complete

**Start now:**
```bash
# Step 1: Login
TOKEN=$(curl -s -X POST https://21tunnel.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ultraslim.dev","password":"TestPass123!"}' \
  | jq -r '.token')

# Step 2: Create API Key
curl -X POST https://21tunnel.com/api/api-keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"my-first-key"}'

# Step 3: Use API Key to authenticate CLI agent
# See documentation for agent setup

# Step 4: Create tunnels via agent
# Connect locally and expose to internet!
```

---

**Created**: February 19, 2026
**Platform**: UltraSlim v1.0
**Status**: ✅ Production Ready

Enjoy secure tunneling! 🚀
