#!/usr/bin/env node

/**
 * Express ERP MCP Server - HTTP Version
 * Serwer MCP dla systemu ERP - weryfikacja zamówień przez HTTP/SSE
 */

import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { getConfig, validateConfig } from './config/index.js';
import { ApiClient } from './services/apiClient.js';
import { DatabaseClient } from './services/databaseClient.js';
import { verifyOrderTool, handleVerifyOrder } from './tools/orderVerification.js';
import {
  getDatabaseSchemaTool,
  executeSQLLimitedTool,
  handleGetDatabaseSchema,
  handleExecuteSQLLimited,
} from './tools/databaseTools.js';

/**
 * Logowanie
 */
function log(level: string, message: string, ...args: unknown[]): void {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [${level.toUpperCase()}] ${message}`, ...args);
}

/**
 * Główna funkcja serwera
 */
async function main(): Promise<void> {
  log('info', 'Uruchamianie Express ERP MCP Server (HTTP)...');

  try {
    // Wczytaj i waliduj konfigurację
    const config = getConfig();
    validateConfig(config);
    log('info', 'Konfiguracja załadowana pomyślnie');

    // Utwórz klienta API
    const apiClient = new ApiClient(config);
    log('info', 'Klient API zainicjalizowany');

    // Utwórz klienta bazy danych
    const databaseClient = new DatabaseClient(config);
    if (config.supabaseProjectUrl && config.supabaseBearerToken) {
      log('info', 'Klient bazy danych zainicjalizowany [Bearer Token - z RLS]');
      log('info', '✓ Wszystkie zapytania respektują Row Level Security - bezpieczne dla agentów AI');
    } else {
      log('warn', 'Klient bazy danych nie został skonfigurowany. Narzędzia database będą niedostępne.');
    }

    // Utwórz Express app
    const app = express();
    const port = process.env.PORT || 3000;

    // Middleware
    app.use(cors());
    app.use(express.json());

    // Health check endpoint
    app.get('/health', (_req, res) => {
      res.json({
        status: 'healthy',
        service: 'express-erp-mcp',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      });
    });

    // Info endpoint
    app.get('/', (_req, res) => {
      res.json({
        name: 'Express ERP MCP Server',
        version: '1.0.0',
        description: 'MCP Server dla systemu ERP - weryfikacja zamówień',
        endpoints: {
          health: '/health',
          sse: '/sse',
          test: '/test',
        },
        tools: ['verify_order', 'get_database_schema', 'execute_sql_limited'],
      });
    });

    // Test endpoint do weryfikacji zamówień bez MCP
    app.post('/test/verify-order', async (req, res) => {
      try {
        const { numer_zamowienia } = req.body;

        if (!numer_zamowienia || typeof numer_zamowienia !== 'string') {
          return res.status(400).json({
            error: 'Parametr numer_zamowienia jest wymagany i musi być stringiem',
          });
        }

        const result = await handleVerifyOrder(apiClient, { numer_zamowienia });
        return res.json(result);
      } catch (error) {
        log('error', 'Błąd w test endpoint:', error);
        return res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // SSE endpoint dla MCP
    app.get('/sse', async (req, res) => {
      log('info', 'Nowe połączenie SSE');

      // Utwórz serwer MCP dla tego połączenia
      const mcpServer = new Server(
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
      mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
        log('info', 'Otrzymano żądanie list_tools');
        return {
          tools: [verifyOrderTool, getDatabaseSchemaTool, executeSQLLimitedTool],
        };
      });

      // Zarejestruj handler dla call_tool
      mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        log('info', `Otrzymano żądanie call_tool: ${name}`);

        if (name === 'verify_order') {
          return await handleVerifyOrder(apiClient, args);
        }

        if (name === 'get_database_schema') {
          return await handleGetDatabaseSchema(databaseClient, args);
        }

        if (name === 'execute_sql_limited') {
          return await handleExecuteSQLLimited(databaseClient, args);
        }

        throw new Error(`Nieznane narzędzie: ${name}`);
      });

      // Obsługa błędów serwera
      mcpServer.onerror = (error) => {
        log('error', 'Błąd serwera MCP:', error);
      };

      // Utwórz transport SSE
      const transport = new SSEServerTransport('/message', res);

      // Połącz serwer z transportem
      await mcpServer.connect(transport);
      log('info', 'Połączenie SSE ustanowione');

      // Obsłuż zamknięcie połączenia
      req.on('close', () => {
        log('info', 'Połączenie SSE zamknięte');
        mcpServer.close();
      });
    });

    // Endpoint do wysyłania wiadomości (POST dla MCP)
    app.post('/message', async (_req, res) => {
      log('info', 'Otrzymano wiadomość POST /message');
      // To jest obsługiwane przez SSEServerTransport
      res.status(200).json({ received: true });
    });

    // Uruchom serwer
    app.listen(port, () => {
      log('info', `Express ERP MCP Server uruchomiony na porcie ${port}`);
      log('info', `Health check: http://localhost:${port}/health`);
      log('info', `SSE endpoint: http://localhost:${port}/sse`);
      log('info', `Test endpoint: POST http://localhost:${port}/test/verify-order`);
      log('info', 'Oczekiwanie na połączenia...');
    });
  } catch (error) {
    log('error', 'Krytyczny błąd podczas uruchamiania serwera:', error);

    if (error instanceof Error) {
      console.error(`\nBŁĄD: ${error.message}\n`);

      // Pomocne wskazówki
      if (error.message.includes('SUPABASE_PROJECT_URL')) {
        console.error('Ustaw zmienną środowiskową SUPABASE_PROJECT_URL');
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
