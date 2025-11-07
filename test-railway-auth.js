#!/usr/bin/env node

/**
 * Test serwera MCP na Railway z autentykacją API key
 */

import { randomUUID } from 'crypto';

const RAILWAY_URL = 'https://expresserpmcp-production.up.railway.app';
const API_KEY = 'erp_mcp_2025_secure_key_7h9x2k4p';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function sendRequest(method, params = {}, sessionId = null, useAuth = true) {
  log(`\n📤 Wysyłam: ${method}`, 'bright');

  const request = {
    jsonrpc: '2.0',
    id: randomUUID(),
    method,
    params,
  };

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  };

  if (sessionId) {
    headers['Mcp-Session-Id'] = sessionId;
  }

  if (useAuth) {
    headers['Authorization'] = `Bearer ${API_KEY}`;
    log(`🔑 Using Authorization: Bearer ${API_KEY.substring(0, 20)}...`, 'yellow');
  } else {
    log('⚠️  NO Authorization header (testing unauthorized)', 'yellow');
  }

  try {
    const response = await fetch(`${RAILWAY_URL}/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    log(`📡 HTTP Status: ${response.status}`, response.ok ? 'green' : 'red');

    if (!response.ok) {
      const text = await response.text();
      log(`❌ Error Response: ${text}`, 'red');
      return null;
    }

    const data = await response.json();
    log(`📨 Odpowiedź: ${JSON.stringify(data, null, 2)}`, 'blue');

    if (data.error) {
      log(`❌ Błąd: ${data.error.message}`, 'red');
      return null;
    }

    return data.result;
  } catch (error) {
    log(`❌ Błąd połączenia: ${error.message}`, 'red');
    return null;
  }
}

async function testRailway() {
  log('\n🧪 Testowanie serwera MCP na Railway z autentykacją...\n', 'bright');
  log(`🌐 URL: ${RAILWAY_URL}`, 'yellow');
  log(`🔑 API Key: ${API_KEY}\n`, 'yellow');

  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Health check (publiczny - bez auth)
  log('='.repeat(50), 'bright');
  log('TEST 1: Health Check (publiczny endpoint - bez API key)', 'bright');
  log('='.repeat(50), 'bright');

  try {
    const healthRes = await fetch(`${RAILWAY_URL}/health`);
    const health = await healthRes.json();
    log(`📨 ${JSON.stringify(health, null, 2)}`, 'blue');
    log('✓ Health check OK', 'green');
    testsPassed++;
  } catch (e) {
    log(`✗ Health check failed: ${e.message}`, 'red');
    testsFailed++;
  }

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Initialize БЕЗ API key (powinien zwrócić 401)
  log('\n' + '='.repeat(50), 'bright');
  log('TEST 2: Initialize BEZ API key (oczekiwany 401/403)', 'bright');
  log('='.repeat(50), 'bright');

  const initNoAuth = await sendRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '1.0.0' },
  }, null, false); // useAuth = false

  if (!initNoAuth) {
    log('✓ Poprawnie odrzucono żądanie bez API key', 'green');
    testsPassed++;
  } else {
    log('✗ Żądanie bez API key POWINNO zostać odrzucone!', 'red');
    testsFailed++;
  }

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 3: Initialize Z API key
  log('\n' + '='.repeat(50), 'bright');
  log('TEST 3: Initialize Z poprawnym API key', 'bright');
  log('='.repeat(50), 'bright');

  const initResult = await sendRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '1.0.0' },
  }, null, true); // useAuth = true

  let sessionId = null;
  if (initResult) {
    log('✓ Sesja zainicjalizowana z API key', 'green');
    sessionId = initResult.sessionId || randomUUID();
    log(`  Session ID: ${sessionId}`, 'yellow');
    testsPassed++;
  } else {
    log('✗ Nie udało się zainicjalizować sesji', 'red');
    testsFailed++;
  }

  if (!sessionId) {
    log('\n⚠️  Brak Session ID - pomijam dalsze testy', 'yellow');
    return;
  }

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 4: List Tools Z API key
  log('\n' + '='.repeat(50), 'bright');
  log('TEST 4: List Tools Z API key', 'bright');
  log('='.repeat(50), 'bright');

  const toolsResult = await sendRequest('tools/list', {}, sessionId, true);

  if (toolsResult?.tools) {
    log('✓ Lista narzędzi pobrana', 'green');
    log(`  Znalezionych narzędzi: ${toolsResult.tools.length}`, 'yellow');
    toolsResult.tools.forEach(tool => {
      log(`  - ${tool.name}`, 'yellow');
    });
    testsPassed++;
  } else {
    log('✗ Nie udało się pobrać listy narzędzi', 'red');
    testsFailed++;
  }

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 5: Verify Order Z API key
  log('\n' + '='.repeat(50), 'bright');
  log('TEST 5: Verify Order OP1001 Z API key', 'bright');
  log('='.repeat(50), 'bright');

  const verifyResult = await sendRequest('tools/call', {
    name: 'verify_order',
    arguments: { numer_zamowienia: 'OP1001' },
  }, sessionId, true);

  if (verifyResult?.content) {
    log('✓ Weryfikacja wykonana', 'green');
    const text = verifyResult.content[0]?.text || '';
    log(`  Wynik:\n${text}`, 'yellow');
    testsPassed++;
  } else {
    log('✗ Weryfikacja nie powiodła się', 'red');
    testsFailed++;
  }

  // Podsumowanie
  log('\n' + '='.repeat(50), 'bright');
  log('📊 PODSUMOWANIE', 'bright');
  log('='.repeat(50), 'bright');
  log(`✓ Testy zaliczone: ${testsPassed}`, 'green');
  log(`✗ Testy niezaliczone: ${testsFailed}`, testsFailed > 0 ? 'red' : 'green');
  log('='.repeat(50) + '\n', 'bright');

  process.exit(testsFailed > 0 ? 1 : 0);
}

testRailway().catch(error => {
  log(`\n❌ Błąd krytyczny: ${error}`, 'red');
  process.exit(1);
});
