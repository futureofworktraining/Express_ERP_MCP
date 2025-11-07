#!/usr/bin/env node

/**
 * Express ERP MCP Server
 * Serwer MCP dla systemu ERP - weryfikacja zamówień
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { getConfig, validateConfig } from './config/index.js';
import { ApiClient } from './services/apiClient.js';
import { verifyOrderTool, handleVerifyOrder } from './tools/orderVerification.js';

/**
 * Logowanie
 */
function log(level: string, message: string, ...args: unknown[]): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

  if (level === 'error') {
    console.error(logMessage, ...args);
  } else {
    console.log(logMessage, ...args);
  }
}

/**
 * Główna funkcja serwera
 */
async function main(): Promise<void> {
  log('info', 'Uruchamianie Express ERP MCP Server...');

  try {
    // Wczytaj i waliduj konfigurację
    const config = getConfig();
    validateConfig(config);
    log('info', 'Konfiguracja załadowana pomyślnie');

    // Utwórz klienta API
    const apiClient = new ApiClient(config);
    log('info', 'Klient API zainicjalizowany');

    // Utwórz serwer MCP
    const server = new Server(
      {
        name: 'express-erp-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Zarejestruj handler dla list_tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      log('info', 'Otrzymano żądanie list_tools');
      return {
        tools: [verifyOrderTool],
      };
    });

    // Zarejestruj handler dla call_tool
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      log('info', `Otrzymano żądanie call_tool: ${name}`);

      if (name === 'verify_order') {
        return await handleVerifyOrder(apiClient, args);
      }

      throw new Error(`Nieznane narzędzie: ${name}`);
    });

    // Obsługa błędów serwera
    server.onerror = (error) => {
      log('error', 'Błąd serwera:', error);
    };

    // Utwórz transport stdio
    const transport = new StdioServerTransport();
    log('info', 'Transport stdio utworzony');

    // Połącz serwer z transportem
    await server.connect(transport);
    log('info', 'Express ERP MCP Server uruchomiony pomyślnie');
    log('info', 'Oczekiwanie na żądania...');
  } catch (error) {
    log('error', 'Krytyczny błąd podczas uruchamiania serwera:', error);

    if (error instanceof Error) {
      console.error(`\nBŁĄD: ${error.message}\n`);

      // Pomocne wskazówki
      if (error.message.includes('SUPABASE_URL')) {
        console.error('Ustaw zmienną środowiskową SUPABASE_URL');
      } else if (error.message.includes('SUPABASE_BEARER_TOKEN')) {
        console.error('Ustaw zmienną środowiskową SUPABASE_BEARER_TOKEN');
      }
    }

    process.exit(1);
  }
}

// Obsługa sygnałów zakończenia
process.on('SIGINT', () => {
  log('info', 'Otrzymano SIGINT, zamykanie serwera...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('info', 'Otrzymano SIGTERM, zamykanie serwera...');
  process.exit(0);
});

// Obsługa nieobsłużonych błędów
process.on('uncaughtException', (error) => {
  log('error', 'Nieobsłużony wyjątek:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log('error', 'Nieobsłużone odrzucenie Promise:', reason);
  process.exit(1);
});

// Uruchom serwer
main();
