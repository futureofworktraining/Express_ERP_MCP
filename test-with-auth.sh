#!/bin/bash

# Test serwera MCP z autentykacją API key

API_KEY="erp_mcp_2025_secure_key_7h9x2k4p"
URL="https://expresserpmcp-production.up.railway.app"

echo "==================================================="
echo "Test 1: Health Check (bez auth - publiczny)"
echo "==================================================="
curl -s "$URL/health" | jq .
echo ""

echo "==================================================="
echo "Test 2: MCP bez API key (powinien zwrócić 401)"
echo "==================================================="
curl -s -X POST "$URL/mcp" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    }
  }' | jq .
echo ""

echo "==================================================="
echo "Test 3: MCP z poprawnym API key"
echo "==================================================="
SESSION_ID=$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "test-$(date +%s)")

INIT_RESPONSE=$(curl -s -X POST "$URL/mcp" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    }
  }')

echo "$INIT_RESPONSE" | jq .

# Extract session ID
NEW_SESSION_ID=$(echo "$INIT_RESPONSE" | jq -r '.result.sessionId // empty')
if [ -n "$NEW_SESSION_ID" ]; then
  SESSION_ID="$NEW_SESSION_ID"
fi
echo ""
echo "Session ID: $SESSION_ID"
echo ""

echo "==================================================="
echo "Test 4: List Tools (z API key)"
echo "==================================================="
curl -s -X POST "$URL/mcp" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }' | jq .
echo ""

echo "==================================================="
echo "Test 5: Verify Order OP1001 (z API key)"
echo "==================================================="
curl -s -X POST "$URL/mcp" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "verify_order",
      "arguments": {
        "numer_zamowienia": "OP1001"
      }
    }
  }' | jq .
echo ""

echo "==================================================="
echo "Zakończono testy"
echo "==================================================="
