# UltraSlim Client Deployment & Script Reference Guide

**Date**: February 19, 2026
**Domain**: https://21tunnel.com
**Status**: ✅ Production Ready

---

## 📍 Script Locations & Availability

### Official Repository
**URL**: https://github.com/vikasswaminh/tunnel-buddy-appliance
**Default Branch**: `main`

### Available Client Scripts

| Script | Location | Language | Purpose |
|--------|----------|----------|---------|
| Test Client (Python) | `test_client.py` | Python 3 | 12 comprehensive API tests |
| Test Client (Node.js) | `test_client.js` | JavaScript | 12 comprehensive API tests |
| Deployment Tests | `deploy/test_all.py` | Python 3 | Full endpoint testing (31+ tests) |

---

## 🐍 Python Test Client

### Location
```
Repository: https://github.com/vikasswaminh/tunnel-buddy-appliance
File: test_client.py
```

### Quick Start
```bash
# Clone repository
git clone https://github.com/vikasswaminh/tunnel-buddy-appliance.git
cd tunnel-buddy-appliance

# Run tests
python3 test_client.py
```

### What It Tests
1. ✅ Health Check - `/api/health`
2. ✅ Admin Login - `/api/auth/login`
3. ✅ User Signup - `/api/auth/signup`
4. ✅ Get Profile - `/api/profile`
5. ✅ Create Tunnel - `/api/tunnels` (POST)
6. ✅ List Tunnels - `/api/tunnels` (GET)
7. ✅ Get Tunnel Details - `/api/tunnels/{id}`
8. ✅ Create API Key - `/api/api-keys`
9. ✅ Get Metrics - `/api/metrics`
10. ✅ Get Alerts - `/api/alerts`
11. ✅ Circuit Breaker Status - `/api/circuit-breaker/status`
12. ✅ Delete Tunnel - `/api/tunnels/{id}` (DELETE)

### Configuration
```python
# Default: Uses production API
client = APITestClient(base_url='https://21tunnel.com')

# Custom domain
client = APITestClient(base_url='https://your-domain.com')
```

### Output
- Real-time test results with timestamps
- JSON export of results
- Pass/Fail status for each test
- Performance metrics

### Test Credentials (Pre-configured)
```
Admin Email: admin@ultraslim.dev
Admin Password: TestPass123!
```

---

## 🔗 JavaScript/Node.js Test Client

### Location
```
Repository: https://github.com/vikasswaminh/tunnel-buddy-appliance
File: test_client.js
```

### Quick Start
```bash
# Clone repository
git clone https://github.com/vikasswaminh/tunnel-buddy-appliance.git
cd tunnel-buddy-appliance

# Install dependencies
npm install node-fetch

# Run tests
node test_client.js
```

### Configuration
```javascript
// Default: Uses production API
const client = new APITestClient('https://21tunnel.com');

// Custom domain
const client = new APITestClient('https://your-domain.com');
```

### Features
- Async/await pattern
- JSON result export
- Error handling
- Identical tests to Python version

---

## 🚀 Deployment Test Suite

### Location
```
Repository: https://github.com/vikasswaminh/tunnel-buddy-appliance
File: deploy/test_all.py
```

### Purpose
Complete testing of ALL 31+ API endpoints for deployment verification.

### Usage (On Droplet)
```bash
# SSH into droplet (139.59.93.230)
ssh root@139.59.93.230

# Run from droplet (tests localhost:8080)
cd /app
python3 deploy/test_all.py
```

### What It Tests
- All authentication endpoints
- All tunnel management endpoints
- All user management endpoints
- All analytics endpoints
- Rate limiting verification
- Error handling
- Database operations

### Requirements
- Python 3.8+
- curl command-line tool
- Access to localhost:8080 (droplet-only)

---

## 🔧 Client Integration Guide

### JavaScript/TypeScript Example
```javascript
import fetch from 'node-fetch';

const client = {
  baseUrl: 'https://21tunnel.com',
  token: null,

  async login(email, password) {
    const response = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    this.token = data.token;
    return data;
  },

  async getTunnels() {
    const response = await fetch(`${this.baseUrl}/api/tunnels`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    return response.json();
  }
};

// Usage
await client.login('admin@ultraslim.dev', 'TestPass123!');
const tunnels = await client.getTunnels();
```

### Python Example
```python
import requests

class UltraSlimClient:
    def __init__(self, base_url='https://21tunnel.com'):
        self.base_url = base_url
        self.token = None
        self.session = requests.Session()

    def login(self, email, password):
        response = self.session.post(
            f'{self.base_url}/api/auth/login',
            json={'email': email, 'password': password}
        )
        data = response.json()
        self.token = data['token']
        return data

    def get_tunnels(self):
        response = self.session.get(
            f'{self.base_url}/api/tunnels',
            headers={'Authorization': f'Bearer {self.token}'}
        )
        return response.json()

# Usage
client = UltraSlimClient()
client.login('admin@ultraslim.dev', 'TestPass123!')
tunnels = client.get_tunnels()
```

### cURL Example
```bash
# Login
TOKEN=$(curl -s -X POST https://21tunnel.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@ultraslim.dev",
    "password": "TestPass123!"
  }' | jq -r '.token')

# Use token
curl https://21tunnel.com/api/tunnels \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📊 Client Settings Configuration

### Base URL
```
Production: https://21tunnel.com
```

### API Endpoints (All clients)
```
/api/auth/login           - POST   - Login with email/password
/api/auth/signup          - POST   - Create new account
/api/auth/logout          - POST   - Logout (requires token)
/api/auth/refresh         - POST   - Refresh JWT token
/api/auth/forgot-password - POST   - Initiate password reset
/api/auth/reset-password  - POST   - Complete password reset

/api/profile              - GET    - Get user profile
/api/profile              - PUT    - Update user profile
/api/users                - GET    - List users (admin)
/api/users/{id}           - GET    - Get user details
/api/users/{id}           - PUT    - Update user
/api/users/{id}           - DELETE - Delete user

/api/tunnels              - GET    - List user's tunnels
/api/tunnels              - POST   - Create new tunnel
/api/tunnels/{id}         - GET    - Get tunnel details
/api/tunnels/{id}         - PUT    - Update tunnel
/api/tunnels/{id}         - DELETE - Delete tunnel

/api/api-keys             - GET    - List API keys
/api/api-keys             - POST   - Create API key
/api/api-keys/{id}        - DELETE - Delete API key

/api/analytics            - GET    - Get analytics
/api/connection-logs      - GET    - Get connection logs
/api/notifications        - GET    - Get notifications
/api/audit-logs           - GET    - Get audit logs

/api/metrics              - GET    - Get system metrics
/api/alerts               - GET    - Get active alerts
/api/circuit-breaker/status - GET  - Get circuit breaker status
/api/health               - GET    - Health check
```

### Authentication Headers
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Rate Limiting (Per-IP)
```
/api/auth/login         - 10 requests/minute (burst 5)
/api/auth/signup        - 5 requests/minute (burst 3)
/api/auth/forgot-password - 3 requests/hour (burst 2)
/api/auth/reset-password  - 3 requests/hour (burst 2)
/ws/agent               - 20 requests/minute (burst 5)
```

### Response Codes
```
200 OK                  - Request successful
201 Created             - Resource created
204 No Content          - Request successful (no body)
400 Bad Request         - Invalid input
401 Unauthorized        - Authentication required or failed
403 Forbidden           - Permission denied
404 Not Found           - Resource not found
409 Conflict            - Resource already exists
429 Too Many Requests   - Rate limit exceeded
500 Internal Error      - Server error
```

---

## 🔐 Authentication Details

### JWT Token
- **Format**: HS256 signed JWT
- **Expiry**: 72 hours
- **Issued by**: `/api/auth/login`
- **Required for**: All protected endpoints (except public health/docs)
- **Header**: `Authorization: Bearer <token>`

### Test Accounts (Pre-configured)

#### Admin Account
```
Email: admin@ultraslim.dev
Password: TestPass123!
Role: superadmin
Tunnels: Unlimited
```

#### Regular User Account
```
Email: user@ultraslim.dev
Password: TestPass123!
Role: user
Tunnels: 5 max
```

---

## ✅ Verification Checklist

### Domain Configuration
- [x] Base URL set to `https://21tunnel.com`
- [x] All endpoint URLs use new domain
- [x] Documentation reflects new domain
- [x] Client scripts use new domain
- [x] Test credentials match production
- [x] Rate limiting policies configured

### Client Scripts
- [x] test_client.py located in repository root
- [x] test_client.js located in repository root
- [x] deploy/test_all.py available on droplet
- [x] All scripts tested and working
- [x] All scripts use correct domain (21tunnel.com)
- [x] JSON output available from all clients

### Documentation
- [x] README.md updated with new domain
- [x] QUICK_START.md reflects new domain
- [x] SETUP_GUIDE.md has correct endpoints
- [x] CLIENT_GUIDE.md has working examples
- [x] All code examples use https://21tunnel.com
- [x] This guide documents script locations

### API Endpoints
- [x] All endpoints responding on 21tunnel.com
- [x] HTTPS/WSS working correctly
- [x] CORS configured for new domain
- [x] Rate limiting active
- [x] Authentication working
- [x] Monitoring endpoints operational

---

## 📚 Documentation References

| Document | Purpose | Location |
|----------|---------|----------|
| README.md | Project overview | Root directory |
| QUICK_START.md | 5-minute quickstart | Root directory |
| SETUP_GUIDE.md | Complete API reference | Root directory |
| CREDENTIALS.md | Test accounts & curl examples | Root directory |
| CLIENT_GUIDE.md | Client integration examples | Root directory |
| API_TEST_REPORT.md | Real test results | Root directory |
| PHASE2_ENHANCEMENTS.md | Monitoring & resilience features | Root directory |
| DOMAIN_UPDATE_REPORT.md | Domain change verification | Root directory |
| This File | Client scripts & settings guide | Root directory |

---

## 🔍 Troubleshooting

### Connection Errors
```
Error: "Cannot reach https://21tunnel.com"
Solution: Verify DNS resolution
$ nslookup 21tunnel.com
$ curl -I https://21tunnel.com
```

### Authentication Errors
```
Error: "401 Unauthorized"
Solution: Verify JWT token and credentials
- Ensure token is in Authorization header
- Check token hasn't expired (72 hour limit)
- Try re-logging with test credentials
```

### Rate Limiting
```
Error: "429 Too Many Requests"
Solution: Implement exponential backoff
- Wait before retrying
- Distribute requests over time
- Use burst allowance efficiently
```

### Certificate Errors
```
Error: "SSL certificate problem"
Solution: Update system certificates or use --insecure flag
# For testing only:
curl -k https://21tunnel.com/api/health
```

---

## 📞 Support

### Test Against Production
```bash
# Verify domain is live
curl -I https://21tunnel.com

# Test health endpoint
curl https://21tunnel.com/api/health

# Run full test suite
python3 test_client.py
```

### Environment Details
- **Domain**: https://21tunnel.com
- **Infrastructure**: DigitalOcean Droplet (139.59.93.230)
- **OS**: Ubuntu 24.04
- **TLS**: Caddy 2 with auto-renewal
- **Database**: PostgreSQL 16

---

## ✨ Summary

All client implementations, scripts, and documentation have been updated to reflect the new domain **https://21tunnel.com**:

✅ **Scripts Located at:**
- `test_client.py` - Python test client
- `test_client.js` - Node.js test client
- `deploy/test_all.py` - Comprehensive deployment tests

✅ **All Configured with:**
- Base URL: `https://21tunnel.com`
- Test credentials: `admin@ultraslim.dev / TestPass123!`
- Complete API documentation with examples

✅ **Ready for:**
- Development integration
- Testing and verification
- Production deployment
- Client implementation

---

**Status**: ✅ **PRODUCTION READY**
**Last Updated**: February 19, 2026
**Verified By**: Automated script verification + manual testing
