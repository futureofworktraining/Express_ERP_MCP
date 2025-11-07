#!/bin/bash

# Test serwera MCP na Railway przez HTTP (Streamable HTTP)

URL="https://expresserpmcp-production.up.railway.app"
SESSION_ID=$(uuidgen || cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "test-$(date +%s)")

echo "==================================================="
echo "Test 1: Health Check"
echo "==================================================="
curl -s "$URL/health" | jq .
echo ""

echo "==================================================="
echo "Test 2: Server Info"
echo "==================================================="
curl -s "$URL/" | jq .
echo ""

echo "==================================================="
echo "Test 3: Initialize Session"
echo "==================================================="
INIT_RESPONSE=$(curl -s -X POST "$URL/mcp" \
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
  }')

echo "$INIT_RESPONSE" | jq .

# Extract session ID from response
NEW_SESSION_ID=$(echo "$INIT_RESPONSE" | jq -r '.result.sessionId // empty')
if [ -n "$NEW_SESSION_ID" ]; then
  SESSION_ID="$NEW_SESSION_ID"
  echo ""
  echo "Session ID: $SESSION_ID"
fi
echo ""

echo "==================================================="
echo "Test 4: List Tools"
echo "==================================================="
curl -s -X POST "$URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }' | jq .
echo ""

echo "==================================================="
echo "Test 5: Verify Order OP1001"
echo "==================================================="
curl -s -X POST "$URL/mcp" \
  -H "Content-Type: application/json" \
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
echo "Test 6: Close Session"
echo "==================================================="
curl -s -X DELETE "$URL/mcp" \
  -H "Mcp-Session-Id: $SESSION_ID"
echo ""
echo "Session closed."
