#!/usr/bin/env node

/**
 * Test serwera MCP na Railway (Streamable HTTP)
 */

import { randomUUID } from 'crypto';

const RAILWAY_URL = process.env.RAILWAY_URL || 'https://expresserpmcp-production.up.railway.app';
const SESSION_ID = randomUUID();

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

async function sendRequest(method, params = {}) {
  log(`\n📤 Wysyłam: ${method}`, 'bright');

  const request = {
    jsonrpc: '2.0',
    id: randomUUID(),
    method,
    params,
  };

  try {
    const response = await fetch(`${RAILWAY_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Mcp-Session-Id': SESSION_ID,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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
  log('\n🧪 Testowanie serwera MCP na Railway...\n', 'bright');
  log(`🌐 URL: ${RAILWAY_URL}`, 'yellow');
  log(`🔑 Session ID: ${SESSION_ID}\n`, 'yellow');

  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Inicjalizacja
  log('='.repeat(50), 'bright');
  log('TEST 1: Inicjalizacja sesji', 'bright');
  log('='.repeat(50), 'bright');

  const initResult = await sendRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'test-client',
      version: '1.0.0',
    },
  });

  if (initResult) {
    log('✓ Sesja zainicjalizowana', 'green');
    testsPassed++;
  } else {
    log('✗ Nie udało się zainicjalizować sesji', 'red');
    testsFailed++;
  }

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Lista narzędzi
  log('\n' + '='.repeat(50), 'bright');
  log('TEST 2: Pobieranie listy narzędzi', 'bright');
  log('='.repeat(50), 'bright');

  const toolsResult = await sendRequest('tools/list', {});

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

  // Test 3: Weryfikacja zamówienia (istniejące)
  log('\n' + '='.repeat(50), 'bright');
  log('TEST 3: Weryfikacja zamówienia OP1001', 'bright');
  log('='.repeat(50), 'bright');

  const verifyResult = await sendRequest('tools/call', {
    name: 'verify_order',
    arguments: {
      numer_zamowienia: 'OP1001',
    },
  });

  if (verifyResult?.content) {
    log('✓ Weryfikacja wykonana', 'green');
    const text = verifyResult.content[0]?.text || '';
    log(`  Wynik:\n${text}`, 'yellow');
    testsPassed++;
  } else {
    log('✗ Weryfikacja nie powiodła się', 'red');
    testsFailed++;
  }

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 4: Weryfikacja nieistniejącego zamówienia
  log('\n' + '='.repeat(50), 'bright');
  log('TEST 4: Weryfikacja nieistniejącego zamówienia OP9999', 'bright');
  log('='.repeat(50), 'bright');

  const verifyResult2 = await sendRequest('tools/call', {
    name: 'verify_order',
    arguments: {
      numer_zamowienia: 'OP9999',
    },
  });

  if (verifyResult2?.content) {
    log('✓ Weryfikacja wykonana', 'green');
    const text = verifyResult2.content[0]?.text || '';
    log(`  Wynik:\n${text}`, 'yellow');
    testsPassed++;
  } else {
    log('✗ Weryfikacja nie powiodła się', 'red');
    testsFailed++;
  }

  // Zamknij sesję
  try {
    await fetch(`${RAILWAY_URL}/mcp`, {
      method: 'DELETE',
      headers: { 'Mcp-Session-Id': SESSION_ID },
    });
    log('\n✓ Sesja zamknięta', 'green');
  } catch (e) {
    log('\n✗ Błąd przy zamykaniu sesji', 'yellow');
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
