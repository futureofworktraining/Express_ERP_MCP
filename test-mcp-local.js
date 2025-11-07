#!/usr/bin/env node

/**
 * Prosty skrypt testowy dla MCP servera
 * Testuje weryfikację zamówień przez komunikację STDIO
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

async function testMcpServer() {
  log('\n🧪 Uruchamianie testów MCP servera...\n', 'bright');

  // Ścieżka do zbudowanego serwera
  const serverPath = join(__dirname, 'dist', 'index.js');

  // Uruchom serwer MCP
  const mcpServer = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: process.env,
  });

  let responseBuffer = '';
  let testsPassed = 0;
  let testsFailed = 0;

  // Nasłuchuj na dane z serwera
  mcpServer.stdout.on('data', (data) => {
    responseBuffer += data.toString();

    // Przetwarzaj kompletne wiadomości JSON
    const lines = responseBuffer.split('\n');
    responseBuffer = lines.pop() || ''; // Zachowaj niepełną linię

    for (const line of lines) {
      if (line.trim()) {
        try {
          const response = JSON.parse(line);
          log(`📨 Odpowiedź: ${JSON.stringify(response, null, 2)}`, 'blue');

          // Sprawdź odpowiedź
          if (response.result?.tools) {
            log('✓ Test 1: Lista narzędzi pobrana poprawnie', 'green');
            testsPassed++;
          } else if (response.result?.content) {
            const content = response.result.content[0]?.text || '';
            if (content.includes('✓') || content.includes('✗')) {
              log('✓ Test 2: Weryfikacja zamówienia zakończona', 'green');
              testsPassed++;
            }
          }
        } catch (e) {
          // Ignoruj nieprawidłowe JSON (mogą być logi)
        }
      }
    }
  });

  mcpServer.stderr.on('data', (data) => {
    const message = data.toString();
    if (message.includes('[ERROR]')) {
      log(`❌ Błąd: ${message}`, 'red');
      testsFailed++;
    } else if (message.includes('[INFO]')) {
      log(`ℹ️  ${message.trim()}`, 'yellow');
    }
  });

  // Funkcja wysyłająca żądanie JSON-RPC
  function sendRequest(method, params = {}, id = 1) {
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };
    log(`\n📤 Wysyłam: ${method}`, 'bright');
    mcpServer.stdin.write(JSON.stringify(request) + '\n');
  }

  // Daj serwerowi czas na uruchomienie
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Test 1: Pobierz listę dostępnych narzędzi
  log('\n=== TEST 1: Pobieranie listy narzędzi ===', 'bright');
  sendRequest('tools/list', {}, 1);

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Test 2: Weryfikuj istniejące zamówienie
  log('\n=== TEST 2: Weryfikacja istniejącego zamówienia (OP1001) ===', 'bright');
  sendRequest('tools/call', {
    name: 'verify_order',
    arguments: {
      numer_zamowienia: 'OP1001',
    },
  }, 2);

  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Test 3: Weryfikuj nieistniejące zamówienie
  log('\n=== TEST 3: Weryfikacja nieistniejącego zamówienia (OP9999) ===', 'bright');
  sendRequest('tools/call', {
    name: 'verify_order',
    arguments: {
      numer_zamowienia: 'OP9999',
    },
  }, 3);

  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Zakończ serwer
  log('\n🛑 Zamykanie serwera...', 'yellow');
  mcpServer.kill('SIGTERM');

  // Podsumowanie
  setTimeout(() => {
    log('\n' + '='.repeat(50), 'bright');
    log('📊 PODSUMOWANIE TESTÓW', 'bright');
    log('='.repeat(50), 'bright');
    log(`✓ Testy zaliczone: ${testsPassed}`, 'green');
    log(`✗ Testy niezaliczone: ${testsFailed}`, testsFailed > 0 ? 'red' : 'green');
    log('='.repeat(50) + '\n', 'bright');
    process.exit(testsFailed > 0 ? 1 : 0);
  }, 1000);
}

// Obsługa błędów
process.on('unhandledRejection', (error) => {
  log(`\n❌ Nieobsłużony błąd: ${error}`, 'red');
  process.exit(1);
});

// Uruchom testy
testMcpServer().catch((error) => {
  log(`\n❌ Błąd krytyczny: ${error}`, 'red');
  process.exit(1);
});
