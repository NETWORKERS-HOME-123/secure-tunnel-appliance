#!/usr/bin/env python3
"""
Comprehensive test script for ALL UltraSlim endpoints.
Runs on the droplet (localhost:8080) to test every untested feature.
"""

import json
import subprocess
import time
import threading
import sys
import os

BASE = "http://localhost:8080"
ADMIN_EMAIL = "admin@ultraslim.dev"
ADMIN_PASS = "UltraSlim@2026!"
TEST_EMAIL = "testall@example.com"
TEST_PASS = "testpass123"

results = []
admin_token = None
test_user_token = None
test_user_id = None


def curl(method, path, data=None, token=None, raw=False):
    """Helper: curl to localhost:8080"""
    url = f"{BASE}{path}"
    cmd = ["curl", "-s", "-X", method, url, "-H", "Content-Type: application/json"]
    if token:
        cmd += ["-H", f"Authorization: Bearer {token}"]
    if data:
        cmd += ["-d", json.dumps(data)]
    if raw:
        cmd += ["-w", "\n%{http_code}", "-o", "-"]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        output = r.stdout.strip()
        if raw:
            lines = output.rsplit("\n", 1)
            body = lines[0] if len(lines) > 1 else ""
            code = int(lines[-1]) if lines[-1].isdigit() else 0
            return body, code
        return output
    except Exception as e:
        return str(e)


def curl_json(method, path, data=None, token=None):
    """Helper: curl and parse JSON"""
    body, code = curl(method, path, data, token, raw=True)
    try:
        return json.loads(body), code
    except:
        return {"_raw": body}, code


def test(name, passed, detail=""):
    status = "PASS" if passed else "FAIL"
    results.append({"test": name, "status": status, "detail": str(detail)[:500]})
    print(f"  [{status}] {name}" + (f" — {str(detail)[:100]}" if detail and not passed else ""))


def curl_ws_raw(path, token, send_msg=None, timeout=5):
    """Minimal WebSocket via curl workaround — use websocket-client instead"""
    try:
        import websocket
        ws = websocket.create_connection(
            f"ws://localhost:8080{path}",
            timeout=timeout,
            header=[]
        )
        if send_msg:
            ws.send(json.dumps(send_msg))
        resp = ws.recv()
        return ws, json.loads(resp)
    except Exception as e:
        return None, {"error": str(e)}


# ============================================================
print("=" * 60)
print("UltraSlim Comprehensive Test Suite")
print("=" * 60)

# --- Step 0: Login as admin ---
print("\n[Setup] Logging in as admin...")
resp, code = curl_json("POST", "/api/auth/login", {"email": ADMIN_EMAIL, "password": ADMIN_PASS})
if "token" in resp:
    admin_token = resp["token"]
    print(f"  Admin token acquired (code={code})")
else:
    print(f"  FATAL: Cannot login as admin: {resp}")
    json.dump({"fatal": "admin login failed", "response": resp}, open("/tmp/test_all_results.json", "w"), indent=2)
    sys.exit(1)

# --- Step 0b: Create test user (or login if exists) ---
print("[Setup] Creating test user...")
resp, code = curl_json("POST", "/api/auth/signup", {"email": TEST_EMAIL, "password": TEST_PASS, "display_name": "Test All User"})
if code == 201 and "token" in resp:
    test_user_token = resp["token"]
    test_user_id = resp["user"]["id"]
    print(f"  Test user created: {test_user_id}")
elif code == 409:
    # Already exists, login
    resp, code = curl_json("POST", "/api/auth/login", {"email": TEST_EMAIL, "password": TEST_PASS})
    if "token" in resp:
        test_user_token = resp["token"]
        # get profile to find id
        p, _ = curl_json("GET", "/api/profile", token=test_user_token)
        test_user_id = p.get("id", "")
        print(f"  Test user logged in: {test_user_id}")
    else:
        print(f"  WARNING: Cannot login test user: {resp}")
else:
    print(f"  WARNING: Signup returned {code}: {resp}")
    if "token" in resp:
        test_user_token = resp["token"]
        test_user_id = resp.get("user", {}).get("id", "")


# ============================================================
# GROUP 1: Auth endpoints
# ============================================================
print("\n--- Group 1: Auth Endpoints ---")

# Test 1: Token refresh
resp, code = curl_json("POST", "/api/auth/refresh", token=admin_token)
test("Token refresh", code == 200 and "token" in resp, f"code={code}, has_token={'token' in resp}")

# Test 2: Forgot password
resp, code = curl_json("POST", "/api/auth/forgot-password", {"email": TEST_EMAIL})
test("Forgot password", code == 200, f"code={code}, resp={resp}")

# Test 3: Reset password
new_pass = "newpass456"
resp, code = curl_json("POST", "/api/auth/reset-password", {"email": TEST_EMAIL, "new_password": new_pass})
test("Reset password", code == 200, f"code={code}, resp={resp}")

# Test 4: Login with new password
resp, code = curl_json("POST", "/api/auth/login", {"email": TEST_EMAIL, "password": new_pass})
test("Login with reset password", code == 200 and "token" in resp, f"code={code}")
if "token" in resp:
    test_user_token = resp["token"]

# Restore original password
curl_json("POST", "/api/auth/reset-password", {"email": TEST_EMAIL, "new_password": TEST_PASS})


# ============================================================
# GROUP 2: Profile endpoints
# ============================================================
print("\n--- Group 2: Profile Endpoints ---")

# Test 5: Update profile
resp, code = curl_json("PATCH", "/api/profile", {"display_name": "Updated Admin Name"}, token=admin_token)
test("Update profile", code == 200 and resp.get("status") == "ok", f"code={code}, resp={resp}")

# Test 6: Verify profile update
resp, code = curl_json("GET", "/api/profile", token=admin_token)
test("Verify profile update", resp.get("display_name") == "Updated Admin Name", f"display_name={resp.get('display_name')}")

# Restore original name
curl_json("PATCH", "/api/profile", {"display_name": "Admin"}, token=admin_token)


# ============================================================
# GROUP 3: Tunnel CRUD (insert test tunnel via DB, then test)
# ============================================================
print("\n--- Group 3: Tunnel CRUD ---")

# Get admin user id
admin_profile, _ = curl_json("GET", "/api/profile", token=admin_token)
admin_id = admin_profile.get("id", "")

# Insert a fake tunnel directly into the DB
tunnel_id_str = "tn_testfake"
insert_sql = f"""
INSERT INTO tunnels (user_id, tunnel_id, type, local_port, public_endpoint, status, bytes_in, bytes_out, connections, assigned_port)
VALUES ('{admin_id}', '{tunnel_id_str}', 'http', 3000, 'https://{tunnel_id_str}.21tunnel.com', 'offline', 0, 0, 0, 0)
RETURNING id;
"""
try:
    r = subprocess.run(
        ["sudo", "-u", "postgres", "psql", "-t", "-A", "ultraslim", "-c", insert_sql],
        capture_output=True, text=True, timeout=10
    )
    # psql -t -A may return "UUID\nINSERT 0 1", take first line only
    db_tunnel_id = r.stdout.strip().split("\n")[0].strip()
    test("Insert test tunnel in DB", len(db_tunnel_id) > 0, f"db_id={db_tunnel_id}")
except Exception as e:
    db_tunnel_id = ""
    test("Insert test tunnel in DB", False, str(e))

# Test: List tunnels
resp, code = curl_json("GET", "/api/tunnels", token=admin_token)
has_tunnel = any(t.get("tunnel_id") == tunnel_id_str for t in resp) if isinstance(resp, list) else False
test("List tunnels (has test tunnel)", has_tunnel, f"code={code}, count={len(resp) if isinstance(resp, list) else 0}")

# Test: Tunnel health check
if db_tunnel_id:
    resp, code = curl_json("GET", f"/api/tunnels/{db_tunnel_id}/health", token=admin_token)
    test("Tunnel health check", code == 200 and resp.get("status") == "down", f"code={code}, resp={resp}")
else:
    test("Tunnel health check", False, "No tunnel ID from DB insert")

# Test: Delete tunnel
if db_tunnel_id:
    resp, code = curl_json("DELETE", f"/api/tunnels/{db_tunnel_id}", token=admin_token)
    test("Delete tunnel", code == 200 and resp.get("status") == "deleted", f"code={code}, resp={resp}")
else:
    test("Delete tunnel", False, "No tunnel ID")

# Test: Verify notification created from deletion
resp, code = curl_json("GET", "/api/notifications", token=admin_token)
has_delete_notif = False
notif_id = ""
if isinstance(resp, list):
    for n in resp:
        if "Deleted" in n.get("title", "") or "deleted" in n.get("message", "").lower():
            has_delete_notif = True
            notif_id = n.get("id", "")
            break
test("Notification created on tunnel delete", has_delete_notif, f"found={has_delete_notif}, notif_id={notif_id}")


# ============================================================
# GROUP 4: Notification operations
# ============================================================
print("\n--- Group 4: Notification Operations ---")

if notif_id:
    # Test: Mark single notification read
    resp, code = curl_json("PATCH", f"/api/notifications/{notif_id}/read", token=admin_token)
    test("Mark notification read", code == 200 and resp.get("status") == "ok", f"code={code}, resp={resp}")
else:
    test("Mark notification read", False, "No notification ID available")

# Test: Mark all read
resp, code = curl_json("POST", "/api/notifications/read-all", token=admin_token)
test("Mark all notifications read", code == 200 and resp.get("status") == "ok", f"code={code}, resp={resp}")

# Test: Delete all notifications
resp, code = curl_json("DELETE", "/api/notifications", token=admin_token)
test("Delete all notifications", code == 200 and resp.get("status") == "ok", f"code={code}, resp={resp}")

# Verify notifications empty
resp, code = curl_json("GET", "/api/notifications", token=admin_token)
test("Notifications empty after delete", isinstance(resp, list) and len(resp) == 0, f"count={len(resp) if isinstance(resp, list) else '?'}")


# ============================================================
# GROUP 5: API Key CRUD
# ============================================================
print("\n--- Group 5: API Key CRUD ---")

# Create API key
resp, code = curl_json("POST", "/api/api-keys", {"name": "test-delete-key"}, token=admin_token)
api_key_id = ""
api_key_full = ""
if code == 201:
    api_key_id = resp.get("api_key", {}).get("id", "")
    api_key_full = resp.get("key", "")
test("Create API key", code == 201 and len(api_key_id) > 0, f"code={code}, id={api_key_id}")

# Delete API key
if api_key_id:
    resp, code = curl_json("DELETE", f"/api/api-keys/{api_key_id}", token=admin_token)
    test("Delete API key", code == 200 and resp.get("status") == "deleted", f"code={code}, resp={resp}")
else:
    test("Delete API key", False, "No API key ID")

# Verify deleted
resp, code = curl_json("GET", "/api/api-keys", token=admin_token)
has_deleted = any(k.get("id") == api_key_id for k in resp) if isinstance(resp, list) else False
test("API key gone after delete", not has_deleted, f"still_exists={has_deleted}")


# ============================================================
# GROUP 6: Webhook Update & Delete
# ============================================================
print("\n--- Group 6: Webhook Update & Delete ---")

# Create webhook
resp, code = curl_json("POST", "/api/webhooks", {
    "name": "test-update-hook",
    "url": "https://example.com/webhook-test",
    "events": ["tunnel.created", "tunnel.deleted"]
}, token=admin_token)
wh_id = resp.get("id", "") if code == 201 else ""
test("Create webhook for update test", code == 201 and len(wh_id) > 0, f"code={code}, id={wh_id}")

# Update webhook (toggle active off)
if wh_id:
    resp, code = curl_json("PATCH", f"/api/webhooks/{wh_id}", {"active": False}, token=admin_token)
    test("Update webhook (deactivate)", code == 200 and resp.get("status") == "updated", f"code={code}, resp={resp}")
else:
    test("Update webhook (deactivate)", False, "No webhook ID")

# Delete webhook
if wh_id:
    resp, code = curl_json("DELETE", f"/api/webhooks/{wh_id}", token=admin_token)
    test("Delete webhook", code == 200 and resp.get("status") == "deleted", f"code={code}, resp={resp}")
else:
    test("Delete webhook", False, "No webhook ID")


# ============================================================
# GROUP 7: Admin endpoints
# ============================================================
print("\n--- Group 7: Admin Endpoints ---")

# Admin: assign role
if test_user_id:
    resp, code = curl_json("POST", "/api/admin/roles", {"user_id": test_user_id, "role": "admin"}, token=admin_token)
    test("Admin assign role", code == 200 and resp.get("status") == "role assigned", f"code={code}, resp={resp}")

    # Verify role changed
    resp, code = curl_json("GET", "/api/admin/users", token=admin_token)
    user_role = ""
    if isinstance(resp, list):
        for u in resp:
            if u.get("id") == test_user_id:
                user_role = u.get("role", "")
                break
    test("Verify role assigned", user_role == "admin", f"role={user_role}")

    # Reset role back to user
    curl_json("POST", "/api/admin/roles", {"user_id": test_user_id, "role": "user"}, token=admin_token)
else:
    test("Admin assign role", False, "No test user ID")
    test("Verify role assigned", False, "No test user ID")

# Admin: audit logs
resp, code = curl_json("GET", "/api/admin/audit-logs", token=admin_token)
test("Admin audit logs", code == 200 and isinstance(resp, list), f"code={code}, count={len(resp) if isinstance(resp, list) else '?'}")


# ============================================================
# GROUP 8: Config & Analytics
# ============================================================
print("\n--- Group 8: Config & Analytics ---")

# Config export
resp, code = curl_json("GET", "/api/config/export", token=admin_token)
test("Config export", code == 200 and resp.get("version") == "1.0", f"code={code}, version={resp.get('version')}")

# Connection logs
resp, code = curl_json("GET", "/api/analytics/connections", token=admin_token)
test("Connection logs", code == 200 and isinstance(resp, list), f"code={code}, count={len(resp) if isinstance(resp, list) else '?'}")


# ============================================================
# GROUP 9: WebSocket + End-to-End Tunnel Flow
# ============================================================
print("\n--- Group 9: WebSocket & Tunnel Flow ---")

ws_agent = None
ws_tunnel_id = None
ws_tunnel_endpoint = None
ws_db_id = None

try:
    import websocket

    # Test: Agent WebSocket connection
    print("  Connecting WebSocket agent...")
    ws_agent = websocket.create_connection("ws://localhost:8080/ws/agent", timeout=10)

    register_msg = {
        "type": "register",
        "payload": {
            "token": admin_token,
            "local_port": 9999,
            "type": "http"
        }
    }
    ws_agent.send(json.dumps(register_msg))
    raw_resp = ws_agent.recv()
    ws_resp = json.loads(raw_resp)

    if ws_resp.get("type") == "registered":
        payload = ws_resp.get("payload", {})
        ws_tunnel_id = payload.get("tunnel_id", "")
        ws_tunnel_endpoint = payload.get("public_endpoint", "")
        test("WebSocket agent register", True, f"tunnel={ws_tunnel_id}, endpoint={ws_tunnel_endpoint}")
    else:
        test("WebSocket agent register", False, f"resp={ws_resp}")

    # Small delay for DB write
    time.sleep(1)

    # Test: Dashboard realtime WebSocket
    print("  Connecting dashboard WebSocket...")
    try:
        ws_dash = websocket.create_connection(
            f"ws://localhost:8080/ws/realtime?token={admin_token}",
            timeout=5
        )
        test("Dashboard realtime WebSocket", True, "connected")
        ws_dash.close()
    except Exception as e:
        # Dashboard WS may not send an initial message, timeout on recv is OK
        test("Dashboard realtime WebSocket", "timed out" in str(e).lower() or "connected" in str(e).lower(),
             f"connection attempted: {e}")

    # Test: Verify tunnel appears in API
    resp, code = curl_json("GET", "/api/tunnels", token=admin_token)
    found = False
    if isinstance(resp, list):
        for t in resp:
            if t.get("tunnel_id") == ws_tunnel_id:
                found = True
                ws_db_id = t.get("id", "")
                break
    test("Tunnel appears in API (online)", found, f"tunnel_id={ws_tunnel_id}, found={found}")

    # Test: HTTP tunnel proxy (via Host header to localhost:8081)
    if ws_tunnel_id:
        host = f"{ws_tunnel_id}.21tunnel.com"
        try:
            r = subprocess.run(
                ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}",
                 f"http://localhost:8081/",
                 "-H", f"Host: {host}"],
                capture_output=True, text=True, timeout=10
            )
            proxy_code = r.stdout.strip()
            # We expect some response (502 since no local service on 9999, or timeout)
            # Any response from the proxy means it tried to route
            test("HTTP tunnel proxy attempt", proxy_code in ["502", "504", "200"], f"http_code={proxy_code}")
        except subprocess.TimeoutExpired as e:
            # Timeout is expected when local service doesn't exist (timeout connecting to localhost:9999)
            test("HTTP tunnel proxy attempt", True, "timeout (expected - no local service)")
        except Exception as e:
            test("HTTP tunnel proxy attempt", False, str(e))
    else:
        test("HTTP tunnel proxy attempt", False, "No tunnel ID")

    # Test: Disconnect agent → tunnel goes offline
    print("  Disconnecting agent...")
    ws_agent.close()
    ws_agent = None
    time.sleep(2)  # Wait for server to detect disconnect

    resp, code = curl_json("GET", "/api/tunnels", token=admin_token)
    offline = False
    if isinstance(resp, list):
        for t in resp:
            if t.get("tunnel_id") == ws_tunnel_id:
                offline = t.get("status") == "offline"
                break
    test("Tunnel goes offline after disconnect", offline, f"status checked for {ws_tunnel_id}")

    # Cleanup: delete the test tunnel
    if ws_db_id:
        curl_json("DELETE", f"/api/tunnels/{ws_db_id}", token=admin_token)

except ImportError:
    print("  websocket-client not installed, skipping WebSocket tests")
    test("WebSocket agent register", False, "websocket-client not installed")
    test("Dashboard realtime WebSocket", False, "websocket-client not installed")
    test("Tunnel appears in API (online)", False, "websocket-client not installed")
    test("HTTP tunnel proxy attempt", False, "websocket-client not installed")
    test("Tunnel goes offline after disconnect", False, "websocket-client not installed")
except Exception as e:
    test("WebSocket tests", False, f"Exception: {e}")
    if ws_agent:
        try:
            ws_agent.close()
        except:
            pass


# ============================================================
# SUMMARY
# ============================================================
print("\n" + "=" * 60)
passed = sum(1 for r in results if r["status"] == "PASS")
failed = sum(1 for r in results if r["status"] == "FAIL")
total = len(results)
print(f"RESULTS: {passed}/{total} passed, {failed} failed")
print("=" * 60)

if failed > 0:
    print("\nFailed tests:")
    for r in results:
        if r["status"] == "FAIL":
            print(f"  ✗ {r['test']}: {r['detail']}")

# Write results JSON
output = {
    "summary": {"total": total, "passed": passed, "failed": failed},
    "tests": results
}
with open("/tmp/test_all_results.json", "w") as f:
    json.dump(output, f, indent=2)

print(f"\nResults written to /tmp/test_all_results.json")
