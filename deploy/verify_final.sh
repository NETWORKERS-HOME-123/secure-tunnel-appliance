#!/bin/bash
# Production Verification - Full End-to-End Test

BASE="https://tunnel.networkershome.com"
PASSED=0
FAILED=0

test_case() {
    local name="$1"
    local expected="$2"
    local actual="$3"

    if [[ "$actual" == *"$expected"* ]]; then
        echo "  ✓ $name"
        ((PASSED++))
    else
        echo "  ✗ $name — expected: $expected, got: ${actual:0:50}"
        ((FAILED++))
    fi
}

echo "======================================================================"
echo "UltraSlim Production Verification - WSS Fix & End-to-End"
echo "======================================================================"

# Test 1: Health
echo -e "\n[1] Server Health"
HEALTH=$(curl -s "$BASE/api/health")
test_case "Health check" "healthy" "$HEALTH"

# Test 2: Admin Login
echo -e "\n[2] Authentication"
cat > /tmp/login.json <<'EOF'
{"email":"admin@ultraslim.dev","password":"UltraSlim@2026!"}
EOF
LOGIN=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d @/tmp/login.json)
ADMIN_TOKEN=$(echo "$LOGIN" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
test_case "Admin login" "token" "$LOGIN"

# Test 3: Get Profile
echo -e "\n[3] Profile & Settings"
PROFILE=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/profile")
test_case "Get profile" "admin@ultraslim.dev" "$PROFILE"

# Test 4: Update Profile
cat > /tmp/profile.json <<'EOF'
{"display_name":"Verified Admin"}
EOF
UPDATE=$(curl -s -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d @/tmp/profile.json "$BASE/api/profile")
test_case "Update profile" "ok" "$UPDATE"

# Test 5: List Tunnels
echo -e "\n[4] Tunnel Operations"
TUNNELS=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/tunnels")
test_case "List tunnels" "\[" "$TUNNELS"

# Test 6: Create API Key
echo -e "\n[5] API Key Management"
cat > /tmp/apikey.json <<'EOF'
{"name":"verify-key"}
EOF
APIKEY=$(curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d @/tmp/apikey.json "$BASE/api/api-keys")
APIKEY_ID=$(echo "$APIKEY" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
test_case "Create API key" "usk_" "$APIKEY"

# Test 7: Delete API Key
if [[ -n "$APIKEY_ID" ]]; then
    DELETE=$(curl -s -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/api-keys/$APIKEY_ID")
    test_case "Delete API key" "deleted" "$DELETE"
fi

# Test 8: Create Webhook
echo -e "\n[6] Webhook Management"
cat > /tmp/webhook.json <<'EOF'
{"name":"verify-webhook","url":"https://example.com/webhook","events":["tunnel.created"]}
EOF
WEBHOOK=$(curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d @/tmp/webhook.json "$BASE/api/webhooks")
WEBHOOK_ID=$(echo "$WEBHOOK" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
test_case "Create webhook" "whsec_" "$WEBHOOK"

# Test 9: Update Webhook
if [[ -n "$WEBHOOK_ID" ]]; then
    cat > /tmp/webhook_update.json <<'EOF'
{"active":false}
EOF
    UPDATE=$(curl -s -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d @/tmp/webhook_update.json "$BASE/api/webhooks/$WEBHOOK_ID")
    test_case "Update webhook" "updated" "$UPDATE"

    # Delete webhook
    DELETE=$(curl -s -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/webhooks/$WEBHOOK_ID")
    test_case "Delete webhook" "deleted" "$DELETE"
fi

# Test 10: Notifications
echo -e "\n[7] Notifications"
NOTIF=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/notifications")
test_case "Get notifications" "\[" "$NOTIF"

cat > /tmp/notif_all.json <<'EOF'
{}
EOF
MARK_ALL=$(curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d @/tmp/notif_all.json "$BASE/api/notifications/read-all")
test_case "Mark all read" "ok" "$MARK_ALL"

# Test 11: Admin Functions
echo -e "\n[8] Admin Functions"
USERS=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/admin/users")
test_case "List users" "\[" "$USERS"

AUDIT=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/admin/audit-logs")
test_case "Get audit logs" "\[" "$AUDIT"

# Test 12: Config & Analytics
echo -e "\n[9] Config & Analytics"
CONFIG=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/config/export")
test_case "Export config" "1.0" "$CONFIG"

ANALYTICS=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/analytics")
test_case "Get analytics" "total_tunnels" "$ANALYTICS"

CONNECTIONS=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/analytics/connections")
test_case "Get connection logs" "\[" "$CONNECTIONS"

# Test 13: Frontend
echo -e "\n[10] Frontend SPA"
FRONTEND=$(curl -s -I "$BASE/" | head -1)
test_case "Frontend serves" "200" "$FRONTEND"

# Summary
echo -e "\n======================================================================"
TOTAL=$((PASSED + FAILED))
echo "RESULTS: $PASSED/$TOTAL passed, $FAILED failed"
echo "======================================================================"

if [[ $FAILED -eq 0 ]]; then
    echo "✓ ALL TESTS PASSED - System is fully operational"
    exit 0
else
    echo "✗ SOME TESTS FAILED - See above for details"
    exit 1
fi
