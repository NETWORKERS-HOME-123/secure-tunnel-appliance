# SSL/TLS Troubleshooting Guide - 21tunnel.com

**Date**: February 19, 2026
**Issue**: SSL/TLS Certificate Error (ERR_SSL_PROTOCOL_ERROR)
**Error Code**: SEC_E_ILLEGAL_MESSAGE (0x80090326)
**Status**: ⚠️ Requires Investigation & Fix

---

## 🔴 Current Issue

**Error Message**:
```
This site can't provide a secure connection
21tunnel.com sent an invalid response.
ERR_SSL_PROTOCOL_ERROR
```

**Technical Details**:
- Connection established to 139.59.93.230:443 ✅
- Server is listening on port 443 ✅
- TLS handshake FAILED ❌
- Invalid/corrupted SSL/TLS certificate or configuration

---

## 🔍 Diagnosis

### What's Working
```
✅ DNS resolves correctly (21tunnel.com → 139.59.93.230)
✅ Server is accepting connections on port 443
✅ Network connectivity is good
```

### What's NOT Working
```
❌ TLS/SSL handshake failing
❌ Certificate validation failing
❌ SSL/TLS protocol error on server side
```

### Possible Causes

1. **Certificate Issue**
   - Certificate expired
   - Certificate not installed correctly
   - Certificate mismatch for domain
   - Self-signed certificate without proper setup

2. **Caddy Configuration Issue**
   - Caddy service not running
   - Caddy TLS termination misconfigured
   - Certificate path incorrect

3. **Port Forwarding Issue**
   - Wrong port exposed to internet
   - Port 443 routing to wrong backend
   - Misconfigured reverse proxy

4. **Backend Server Issue**
   - API server responding on wrong port
   - HTTP on port 8080 exposed as HTTPS
   - Backend not responding to TLS

---

## 🔧 Quick Fixes to Try

### Option 1: Restart Caddy Service (Easiest)

**SSH to droplet**:
```bash
ssh root@139.59.93.230
```

**Restart Caddy**:
```bash
systemctl restart caddy
```

**Wait 10 seconds then test**:
```bash
curl https://21tunnel.com/api/health
```

**Expected Output**:
```json
{"status":"healthy","uptime":"..."}
```

---

### Option 2: Check Caddy Status

**SSH to droplet**:
```bash
ssh root@139.59.93.230
```

**Check if Caddy is running**:
```bash
systemctl status caddy
```

**Expected**: `active (running)`

**If not running, start it**:
```bash
systemctl start caddy
```

**Check Caddy logs**:
```bash
journalctl -u caddy -n 50 --no-pager
```

**Look for errors**:
- Certificate loading errors
- Port binding errors
- Configuration parsing errors

---

### Option 3: Verify Certificate Files

**SSH to droplet**:
```bash
ssh root@139.59.93.230
```

**Check certificate files**:
```bash
ls -la /etc/caddy/
ls -la /root/.local/share/caddy/
```

**Verify certificate exists**:
```bash
ls -la /root/.local/share/caddy/certificates/acme-v02.api.letsencrypt.org-directory/
```

**Check certificate details**:
```bash
openssl x509 -in /root/.local/share/caddy/certificates/acme-v02.api.letsencrypt.org-directory/21tunnel.com/ -text -noout
```

---

### Option 4: Check DNS & Port Forwarding

**From local machine**:

```bash
# Check DNS
nslookup 21tunnel.com
# Should show: 139.59.93.230

# Check port 443 is open
curl -I https://21tunnel.com
# Currently fails with SSL error
```

**SSH to droplet**:
```bash
ssh root@139.59.93.230
```

**Check what's listening on port 443**:
```bash
netstat -tlnp | grep 443
lsof -i :443
```

**Expected**:
```
tcp  LISTEN  caddy (or similar TLS proxy)
```

---

### Option 5: Restart Docker (If using Docker)

**SSH to droplet**:
```bash
ssh root@139.59.93.230
```

**Stop all containers**:
```bash
docker-compose down
```

**Start services**:
```bash
docker-compose up -d
```

**Wait 30 seconds**:
```bash
sleep 30
```

**Test connection**:
```bash
curl https://21tunnel.com/api/health
```

---

## 📋 Diagnostic Checklist

Run this on the droplet to diagnose the issue:

```bash
#!/bin/bash

echo "=== UltraSlim SSL/TLS Diagnostics ==="
echo ""

echo "1. Check Caddy Status:"
systemctl status caddy --no-pager | head -5

echo ""
echo "2. Check if port 443 is listening:"
netstat -tlnp | grep 443 || echo "❌ Port 443 not listening"

echo ""
echo "3. Check certificate:"
if [ -d "/root/.local/share/caddy/certificates" ]; then
    echo "✅ Certificate directory exists"
    ls -la /root/.local/share/caddy/certificates/
else
    echo "❌ Certificate directory not found"
fi

echo ""
echo "4. Check Caddy logs (last 20 lines):"
journalctl -u caddy -n 20 --no-pager

echo ""
echo "5. Check port 8080 (backend):"
netstat -tlnp | grep 8080 || echo "❌ Port 8080 not listening"

echo ""
echo "6. Test health endpoint (localhost):"
curl http://localhost:8080/api/health || echo "❌ Backend not responding"
```

**Save as** `/tmp/diagnose.sh` and run:
```bash
bash /tmp/diagnose.sh
```

---

## 🛠️ Detailed Fix Instructions

### Fix #1: Caddy Certificate Issue

**SSH to droplet**:
```bash
ssh root@139.59.93.230
```

**Stop Caddy**:
```bash
systemctl stop caddy
```

**Remove old certificates** (if corrupted):
```bash
rm -rf /root/.local/share/caddy/certificates/
```

**Restart Caddy** (will request new certificate):
```bash
systemctl start caddy
```

**Monitor certificate request**:
```bash
journalctl -u caddy -f
# Press Ctrl+C when certificate is obtained
```

**Wait 30 seconds, then test**:
```bash
sleep 30
curl https://21tunnel.com/api/health
```

---

### Fix #2: Caddy Configuration Issue

**Check Caddyfile**:
```bash
ssh root@139.59.93.230
cat /etc/caddy/Caddyfile
```

**Verify it has**:
```
21tunnel.com {
    reverse_proxy localhost:8080
    tls {
        dns route53
    }
}

:8081 {
    reverse_proxy localhost:8081
}
```

**Test configuration**:
```bash
caddy validate --config /etc/caddy/Caddyfile
```

**If errors, fix and reload**:
```bash
systemctl reload caddy
```

---

### Fix #3: Backend Not Running

**SSH to droplet**:
```bash
ssh root@139.59.93.230
```

**Check if UltraSlim backend is running**:
```bash
ps aux | grep ultraslim
ps aux | grep "go run"
docker ps
```

**If not running, start it**:
```bash
cd /app
go run ./cmd/server &
# or
docker-compose up -d
```

**Verify it's listening on 8080**:
```bash
curl http://localhost:8080/api/health
```

---

## ✅ Verification After Fix

**Local Test**:
```bash
# From your Windows machine
curl https://21tunnel.com/api/health
# Should return: {"status":"healthy",...}
```

**Browser Test**:
```
https://21tunnel.com
# Should load without SSL error
```

**PowerShell Test**:
```powershell
powershell -ExecutionPolicy Bypass -File test_client.ps1
# All 12 tests should pass
```

---

## 🔐 Certificate Details

**Expected Certificate**:
```
Domain:         21tunnel.com
Issuer:         Let's Encrypt
Type:           TLS 1.3 / TLS 1.2
Auto-renewal:   Enabled (Caddy)
Expiry:         ~90 days from issue date
```

**Check Certificate**:
```bash
# From your machine
openssl s_client -connect 21tunnel.com:443 -showcerts
```

**Expected Output**:
```
subject=CN = 21tunnel.com
issuer=C = US, O = Let's Encrypt, CN = R3
```

---

## 📞 Support Steps

If the quick fixes don't work:

1. **SSH to droplet**:
   ```bash
   ssh root@139.59.93.230
   ```

2. **Collect diagnostics**:
   ```bash
   systemctl status caddy > /tmp/caddy_status.txt
   journalctl -u caddy -n 100 > /tmp/caddy_logs.txt
   cat /etc/caddy/Caddyfile > /tmp/caddyfile.txt
   netstat -tlnp > /tmp/netstat.txt
   ```

3. **Review logs**:
   ```bash
   cat /tmp/caddy_logs.txt
   # Look for: "certificate", "error", "tls", "handshake"
   ```

4. **Check backend**:
   ```bash
   curl http://localhost:8080/api/health
   curl http://localhost:8081/api/health
   ```

---

## 🔄 Temporary Workaround

If HTTPS is down but HTTP is working:

**Test via HTTP** (for testing only):
```bash
# Windows PowerShell (modified for HTTP)
$baseUrl = "http://139.59.93.230:8080"
curl -Uri "$baseUrl/api/health"
```

**But this is NOT production-ready** - HTTPS must be fixed before going live.

---

## 📋 Checklist for Complete Fix

- [ ] SSH access to droplet verified
- [ ] Caddy service status checked
- [ ] Certificates directory verified
- [ ] Port 443 confirmed listening
- [ ] Caddyfile configuration validated
- [ ] Backend (port 8080) responding
- [ ] Tunnel proxy (port 8081) responding
- [ ] Certificate not expired
- [ ] DNS records correct
- [ ] `curl https://21tunnel.com/api/health` returns 200
- [ ] Browser loads https://21tunnel.com without SSL error
- [ ] All test clients passing
- [ ] TLS 1.2+ enabled
- [ ] Certificate auto-renewal configured

---

## 📊 Common Solutions Summary

| Issue | Solution | Time |
|-------|----------|------|
| Caddy not running | `systemctl restart caddy` | 1 min |
| Certificate expired | Caddy auto-renews | 2 min |
| Certificate corrupted | Delete and restart | 5 min |
| Wrong port | Check Caddyfile | 5 min |
| Backend down | Restart backend | 2 min |
| DNS issue | Verify DNS records | 5 min |

---

## 🎯 Next Steps

1. **Try Option 1** (Restart Caddy) - Takes 1 minute
2. **If still failing**, try Option 2 (Check Status)
3. **If still failing**, run diagnostics from section above
4. **If still failing**, check backend is running
5. **If still failing**, review Caddyfile configuration

---

## 🚀 Recovery Timeline

- **5 minutes**: Restart Caddy and test
- **10 minutes**: Check all services and ports
- **15 minutes**: Review logs and configuration
- **20 minutes**: Full diagnostics and potential rebuild

---

**Status**: ⚠️ **REQUIRES IMMEDIATE ATTENTION**
**Priority**: 🔴 **HIGH** - API is unreachable via HTTPS
**Action**: Follow diagnostic steps above
**Estimated Fix Time**: 5-30 minutes depending on root cause

---

## 📝 Notes for Next Review

If you've fixed this issue, update this document with:
- Root cause identified
- Solution applied
- Time to resolve
- Any configuration changes made
- Prevention measures implemented

---

**Last Updated**: February 19, 2026
**Issue**: SSL/TLS ERR_SSL_PROTOCOL_ERROR
**Status**: ⚠️ Under Investigation
**Next Check**: Immediately after applying fixes
