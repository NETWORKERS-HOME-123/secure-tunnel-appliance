#!/usr/bin/env python3
"""
Production verification script - Test full end-to-end functionality
after WebSocket WSS fix deployment.
"""

import json
import subprocess
import time
import sys

BASE = "https://localhost:8080"  # Test via HTTPS
RESULTS = []

def test(name, passed, detail=""):
    status = "✓" if passed else "✗"
    RESULTS.append({"test": name, "status": "PASS" if passed else "FAIL", "detail": detail})
    print(f"  [{status}] {name}" + (f" — {detail[:80]}" if detail and not passed else ""))

def curl(method, path, data=None, token=None, insecure=True):
    """Curl with insecure flag for self-signed certs"""
    cmd = ["curl", "-s", "-X", method, f"{BASE}{path}"]
    if insecure:
        cmd.insert(2, "-k")  # -k = --insecure (allow self-signed)
    cmd += ["-H", "Content-Type: application/json"]
    if token:
        cmd += ["-H", f"Authorization: Bearer {token}"]
    if data:
        cmd += ["-d", json.dumps(data)]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        return r.stdout.strip()
    except Exception as e:
        return f"ERROR: {e}"

def curl_json(method, path, data=None, token=None):
    """Curl and parse JSON with status code"""
    cmd = ["curl", "-s", "-k", "-w", "\n%{http_code}", "-X", method, f"{BASE}{path}"]
    cmd += ["-H", "Content-Type: application/json"]
    if token:
        cmd += ["-H", f"Authorization: Bearer {token}"]
    if data:
        cmd += ["-d", json.dumps(data)]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        lines = r.stdout.strip().rsplit("\n", 1)
        body = lines[0] if len(lines) > 1 else ""
        code = int(lines[-1]) if lines[-1].isdigit() else 0
        try:
            return json.loads(body), code
        except:
            return {"_raw": body}, code
    except Exception as e:
        return {"error": str(e)}, 0

print("=" * 70)
print("UltraSlim Production Verification - WSS Fix & End-to-End Test")
print("=" * 70)

# Test 1: Server is up
print("\n[1] Server Connectivity")
resp, code = curl_json("GET", "/api/health")
test("Health endpoint responds", code == 200 and resp.get("status"), f"code={code}")

# Test 2: Login
print("\n[2] Authentication")
resp, code = curl_json("POST", "/api/auth/login", {"email": "admin@ultraslim.dev", "password": "UltraSlim@2026!"})
admin_token = resp.get("token", "") if code == 200 else ""
test("Admin login", code == 200 and len(admin_token) > 0, f"code={code}, token={'yes' if admin_token else 'no'}")

# Test 3: New user signup
resp, code = curl_json("POST", "/api/auth/signup", {
    "email": "verify@test.com",
    "password": "testpass123",
    "display_name": "Verify User"
})
user_token = resp.get("token", "") if code == 201 else ""
user_id = resp.get("user", {}).get("id", "") if code == 201 else ""
test("New user signup", code == 201 and len(user_token) > 0, f"code={code}")

# Test 4: Profile access
print("\n[3] Profile & Settings")
resp, code = curl_json("GET", "/api/profile", token=admin_token)
test("Get profile", code == 200 and resp.get("email"), f"email={resp.get('email')}")

# Test 5: Update profile
resp, code = curl_json("PATCH", "/api/profile", {"display_name": "Admin Verified"}, token=admin_token)
test("Update profile", code == 200 and resp.get("status") == "ok", f"code={code}")

# Test 6: Tunnels
print("\n[4] Tunnel Operations")
resp, code = curl_json("GET", "/api/tunnels", token=admin_token)
test("List tunnels", code == 200 and isinstance(resp, list), f"code={code}, count={len(resp) if isinstance(resp, list) else 0}")

# Test 7: API Keys
print("\n[5] API Key Management")
resp, code = curl_json("POST", "/api/api-keys", {"name": "verify-key"}, token=admin_token)
api_key_id = resp.get("api_key", {}).get("id", "") if code == 201 else ""
test("Create API key", code == 201 and len(api_key_id) > 0, f"code={code}")

if api_key_id:
    resp, code = curl_json("DELETE", f"/api/api-keys/{api_key_id}", token=admin_token)
    test("Delete API key", code == 200, f"code={code}")

# Test 8: Webhooks
print("\n[6] Webhook Management")
resp, code = curl_json("POST", "/api/webhooks", {
    "name": "verify-webhook",
    "url": "https://example.com/webhook",
    "events": ["tunnel.created"]
}, token=admin_token)
webhook_id = resp.get("id", "") if code == 201 else ""
test("Create webhook", code == 201 and len(webhook_id) > 0, f"code={code}")

if webhook_id:
    resp, code = curl_json("PATCH", f"/api/webhooks/{webhook_id}", {"active": False}, token=admin_token)
    test("Update webhook", code == 200, f"code={code}")

    resp, code = curl_json("DELETE", f"/api/webhooks/{webhook_id}", token=admin_token)
    test("Delete webhook", code == 200, f"code={code}")

# Test 9: Notifications
print("\n[7] Notifications")
resp, code = curl_json("GET", "/api/notifications", token=admin_token)
test("Get notifications", code == 200 and isinstance(resp, list), f"code={code}, count={len(resp) if isinstance(resp, list) else 0}")

resp, code = curl_json("POST", "/api/notifications/read-all", token=admin_token)
test("Mark all read", code == 200, f"code={code}")

resp, code = curl_json("DELETE", "/api/notifications", token=admin_token)
test("Delete all", code == 200, f"code={code}")

# Test 10: Admin functions
print("\n[8] Admin Functions")
if user_id:
    resp, code = curl_json("POST", "/api/admin/roles", {"user_id": user_id, "role": "admin"}, token=admin_token)
    test("Assign admin role", code == 200, f"code={code}")

resp, code = curl_json("GET", "/api/admin/users", token=admin_token)
test("List users", code == 200 and isinstance(resp, list), f"code={code}, count={len(resp) if isinstance(resp, list) else 0}")

resp, code = curl_json("GET", "/api/admin/audit-logs", token=admin_token)
test("Get audit logs", code == 200 and isinstance(resp, list), f"code={code}, count={len(resp) if isinstance(resp, list) else 0}")

# Test 11: Config & Analytics
print("\n[9] Config & Analytics")
resp, code = curl_json("GET", "/api/config/export", token=admin_token)
test("Export config", code == 200 and resp.get("version"), f"code={code}, version={resp.get('version')}")

resp, code = curl_json("GET", "/api/analytics", token=admin_token)
test("Get analytics", code == 200 and "total_tunnels" in resp, f"code={code}")

resp, code = curl_json("GET", "/api/analytics/connections", token=admin_token)
test("Get connection logs", code == 200 and isinstance(resp, list), f"code={code}")

# Test 12: React Frontend (via curl to check it serves)
print("\n[10] Frontend SPA")
cmd = ["curl", "-s", "-k", "-I", "https://localhost:8080/"]
r = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
headers = r.stdout.strip()
has_html = "text/html" in headers.lower() or "200" in headers.split("\n")[0]
test("SPA serves HTML", has_html, "frontend accessible")

# Summary
print("\n" + "=" * 70)
passed = sum(1 for r in RESULTS if r["status"] == "PASS")
failed = sum(1 for r in RESULTS if r["status"] == "FAIL")
total = len(RESULTS)
print(f"RESULTS: {passed}/{total} passed, {failed} failed")
print("=" * 70)

if failed > 0:
    print("\nFailed tests:")
    for r in RESULTS:
        if r["status"] == "FAIL":
            print(f"  ✗ {r['test']}: {r['detail']}")

# Write results
output = {
    "summary": {"total": total, "passed": passed, "failed": failed},
    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "tests": RESULTS
}

with open("/tmp/verify_production_results.json", "w") as f:
    json.dump(output, f, indent=2)

print(f"\nResults saved to /tmp/verify_production_results.json")
sys.exit(0 if failed == 0 else 1)
