#!/usr/bin/env node

/**
 * Prosty skrypt testowy dla HTTP MCP servera
 * Testuje weryfikację zamówień przez REST API
 */

const BASE_URL = 'http://localhost:3000';

// Kolory w konsoli
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

async function testEndpoint(name, url, options = {}) {
  log(`\n📡 Test: ${name}`, 'bright');
  log(`URL: ${url}`, 'blue');

  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (response.ok) {
      log(`✓ Status: ${response.status} ${response.statusText}`, 'green');
      log(`📄 Odpowiedź: ${JSON.stringify(data, null, 2)}`, 'blue');
      return { success: true, data };
    } else {
      log(`✗ Status: ${response.status} ${response.statusText}`, 'red');
      log(`📄 Odpowiedź: ${JSON.stringify(data, null, 2)}`, 'yellow');
      return { success: false, data };
    }
  } catch (error) {
    log(`❌ Błąd: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function main() {
  log('\n🧪 Uruchamianie testów HTTP MCP servera...\n', 'bright');
  log('='.repeat(60), 'bright');

  let testsPassed = 0;
  let testsFailed = 0;

  // Czekaj na uruchomienie serwera
  log('\n⏳ Czekam na uruchomienie serwera...', 'yellow');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 1: Health check
  log('\n' + '='.repeat(60), 'bright');
  log('TEST 1: Health Check', 'bright');
  log('='.repeat(60), 'bright');
  const healthTest = await testEndpoint('Health Check', `${BASE_URL}/health`);
  if (healthTest.success && healthTest.data.status === 'healthy') {
    testsPassed++;
  } else {
    testsFailed++;
  }

  // Test 2: Info endpoint
  log('\n' + '='.repeat(60), 'bright');
  log('TEST 2: Info Endpoint', 'bright');
  log('='.repeat(60), 'bright');
  const infoTest = await testEndpoint('Info Endpoint', `${BASE_URL}/`);
  if (infoTest.success && infoTest.data.name) {
    testsPassed++;
  } else {
    testsFailed++;
  }

  // Test 3: Weryfikacja istniejącego zamówienia (OP1001)
  log('\n' + '='.repeat(60), 'bright');
  log('TEST 3: Weryfikacja istniejącego zamówienia (OP1001)', 'bright');
  log('='.repeat(60), 'bright');
  const order1Test = await testEndpoint(
    'Weryfikacja zamówienia OP1001',
    `${BASE_URL}/test/verify-order`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        numer_zamowienia: 'OP1001',
      }),
    }
  );
  if (order1Test.success && order1Test.data.content) {
    const text = order1Test.data.content[0]?.text || '';
    if (text.includes('✓') && text.includes('Anna Kowalska')) {
      log('\n✓ Zamówienie znalezione pomyślnie!', 'green');
      testsPassed++;
    } else {
      log('\n✗ Nieprawidłowa odpowiedź', 'red');
      testsFailed++;
    }
  } else {
    testsFailed++;
  }

  // Test 4: Weryfikacja nieistniejącego zamówienia (OP9999)
  log('\n' + '='.repeat(60), 'bright');
  log('TEST 4: Weryfikacja nieistniejącego zamówienia (OP9999)', 'bright');
  log('='.repeat(60), 'bright');
  const order2Test = await testEndpoint(
    'Weryfikacja zamówienia OP9999',
    `${BASE_URL}/test/verify-order`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        numer_zamowienia: 'OP9999',
      }),
    }
  );
  if (order2Test.success && order2Test.data.content) {
    const text = order2Test.data.content[0]?.text || '';
    if (text.includes('✗') && text.includes('nie zostało znalezione')) {
      log('\n✓ Poprawnie wykryto brak zamówienia!', 'green');
      testsPassed++;
    } else {
      log('\n✗ Nieprawidłowa odpowiedź', 'red');
      testsFailed++;
    }
  } else {
    testsFailed++;
  }

  // Test 5: Walidacja błędnych parametrów
  log('\n' + '='.repeat(60), 'bright');
  log('TEST 5: Walidacja błędnych parametrów', 'bright');
  log('='.repeat(60), 'bright');
  const errorTest = await testEndpoint(
    'Brak parametru numer_zamowienia',
    `${BASE_URL}/test/verify-order`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    }
  );
  if (!errorTest.success && errorTest.data.error) {
    log('\n✓ Poprawnie wykryto błędne parametry!', 'green');
    testsPassed++;
  } else {
    log('\n✗ Powinien być błąd walidacji', 'red');
    testsFailed++;
  }

  // Podsumowanie
  log('\n' + '='.repeat(60), 'bright');
  log('📊 PODSUMOWANIE TESTÓW', 'bright');
  log('='.repeat(60), 'bright');
  log(`✓ Testy zaliczone: ${testsPassed}`, testsPassed > 0 ? 'green' : 'yellow');
  log(`✗ Testy niezaliczone: ${testsFailed}`, testsFailed > 0 ? 'red' : 'green');
  log('='.repeat(60) + '\n', 'bright');

  if (testsFailed === 0) {
    log('🎉 Wszystkie testy przeszły pomyślnie!', 'green');
  } else {
    log('⚠️  Niektóre testy nie powiodły się', 'yellow');
  }

  process.exit(testsFailed > 0 ? 1 : 0);
}

// Uruchom testy
main().catch((error) => {
  log(`\n❌ Błąd krytyczny: ${error}`, 'red');
  process.exit(1);
});
