#!/usr/bin/env node

/**
 * Express ERP MCP Server - Streamable HTTP Version (MCP 2025)
 * Serwer MCP dla systemu ERP - weryfikacja zamówień przez Streamable HTTP
 * Zgodny z MCP specification 2025-06-18
 */

import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

import { getConfig, validateConfig } from './config/index.js';
import { ApiClient } from './services/apiClient.js';
import { DatabaseClient } from './services/databaseClient.js';
import { handleVerifyOrder } from './tools/orderVerification.js';
import {
  handleGetDatabaseSchema,
  handleExecuteSQLLimited,
} from './tools/databaseTools.js';

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
 * Tworzy instancję MCP servera z naszymi narzędziami
 * @param apiClient - Klient API
 * @param databaseClient - Klient bazy danych
 * @param bearerToken - Token autoryzacyjny (opcjonalny, przekazywany do Supabase)
 */
function createMcpServer(
  apiClient: ApiClient,
  databaseClient: DatabaseClient,
  bearerToken?: string
): McpServer {
  const server = new McpServer(
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

  // Rejestracja narzędzia verify_order
  server.registerTool(
    'verify_order',
    {
      title: 'Weryfikacja Zamówienia',
      description:
        'Weryfikuje istnienie zamówienia w systemie ERP i pobiera szczegóły zamówienia. ' +
        'Zwraca informacje o statusie zamówienia, wartości oraz danych klienta.',
      inputSchema: {
        numer_zamowienia: z
          .string()
          .min(1)
          .max(50)
          .describe('Numer zamówienia do weryfikacji (np. OP1001, OP1002). Wymagany parametr.'),
      },
    },
    async (args, _extra) => {
      log('info', `Wywołanie verify_order z argumentami:`, args);

      // Przekaż token do handleVerifyOrder (jeśli został podany podczas tworzenia serwera)
      const result = await handleVerifyOrder(apiClient, args, bearerToken);

      // Konwersja do właściwego typu
      return {
        content: result.content.map((item) => ({
          type: item.type as 'text',
          text: item.text,
        })),
      };
    }
  );

  // Rejestracja narzędzia get_database_schema
  server.registerTool(
    'get_database_schema',
    {
      title: 'Pobierz Strukturę Bazy Danych',
      description:
        'Pobiera szczegółową strukturę bazy danych Supabase. ' +
        'Zwraca informacje o tabelach, kolumnach, relacjach (foreign keys) oraz indeksach.',
      inputSchema: {
        include_relations: z
          .boolean()
          .optional()
          .default(true)
          .describe('Czy dołączyć informacje o relacjach między tabelami (foreign keys)'),
        include_indexes: z
          .boolean()
          .optional()
          .default(true)
          .describe('Czy dołączyć informacje o indeksach'),
        schema: z
          .string()
          .optional()
          .default('public')
          .describe('Nazwa schematu do sprawdzenia (domyślnie: "public")'),
      },
    },
    async (args, _extra) => {
      log('info', `Wywołanie get_database_schema z argumentami:`, args);

      const result = await handleGetDatabaseSchema(databaseClient, args);

      return {
        content: result.content.map((item) => ({
          type: item.type as 'text',
          text: item.text,
        })),
      };
    }
  );

  // Rejestracja narzędzia execute_sql_limited
  server.registerTool(
    'execute_sql_limited',
    {
      title: 'Wykonaj Zapytanie SQL z Limitem',
      description:
        'Wykonuje zapytanie SQL SELECT do bazy danych z domyślnym ograniczeniem liczby rekordów. ' +
        'Dozwolone są TYLKO zapytania SELECT. Domyślny limit to 50 rekordów.',
      inputSchema: {
        query: z
          .string()
          .min(10)
          .describe('Zapytanie SQL SELECT do wykonania. Tylko zapytania SELECT są dozwolone.'),
        limit: z
          .number()
          .min(1)
          .max(1000)
          .optional()
          .describe('Opcjonalny limit rekordów (domyślnie 50, max 1000)'),
        offset: z
          .number()
          .min(0)
          .optional()
          .default(0)
          .describe('Opcjonalny offset dla paginacji'),
      },
    },
    async (args, _extra) => {
      log('info', `Wywołanie execute_sql_limited z argumentami:`, args);

      const result = await handleExecuteSQLLimited(databaseClient, args);

      return {
        content: result.content.map((item) => ({
          type: item.type as 'text',
          text: item.text,
        })),
      };
    }
  );

  return server;
}

/**
 * Główna funkcja serwera
 */
async function main(): Promise<void> {
  log('info', 'Uruchamianie Express ERP MCP Server (Streamable HTTP)...');

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
    app.use(express.json());
    app.use(
      cors({
        origin: '*', // Pozwól wszystkim domenom
        exposedHeaders: ['Mcp-Session-Id'], // Expose session ID header
      })
    );

    // Middleware do przechowywania Authorization header w request
    // Token będzie przekazywany bezpośrednio do Supabase API
    app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
      // Przechowaj Authorization header w req dla późniejszego użycia
      if (req.headers['authorization']) {
        (req as any).authToken = req.headers['authorization'].replace(/^Bearer\s+/i, '');
      }
      next();
    });

    // Mapa przechowująca transporty per sesja
    const transports: Map<string, StreamableHTTPServerTransport> = new Map();

    // Health check endpoint
    app.get('/health', (_req, res) => {
      return res.json({
        status: 'healthy',
        service: 'express-erp-mcp',
        version: '1.0.0',
        protocol: 'streamable-http',
        timestamp: new Date().toISOString(),
        activeSessions: transports.size,
      });
    });

    // Info endpoint
    app.get('/', (_req, res) => {
      return res.json({
        name: 'Express ERP MCP Server',
        version: '1.0.0',
        description: 'MCP Server dla systemu ERP - weryfikacja zamówień',
        protocol: 'MCP Streamable HTTP (2025-06-18)',
        endpoints: {
          health: '/health',
          mcp: '/mcp (GET, POST, DELETE)',
          test: '/test/verify-order',
        },
        tools: ['verify_order', 'get_database_schema', 'execute_sql_limited'],
        activeSessions: transports.size,
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

    // ============================================================
    // MCP Streamable HTTP Endpoint - Zgodny z spec 2025-06-18
    // ============================================================

    /**
     * POST /mcp - Główny endpoint dla żądań MCP
     */
    app.post('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      try {
        let transport: StreamableHTTPServerTransport;

        if (sessionId && transports.has(sessionId)) {
          // Reużyj istniejącego transportu dla tej sesji
          log('info', `Reużywanie transportu dla sesji: ${sessionId}`);
          transport = transports.get(sessionId)!;
        } else if (!sessionId && isInitializeRequest(req.body)) {
          // Nowa sesja - inicjalizacja
          log('info', 'Inicjalizacja nowej sesji MCP');

          // Wyciągnij token z requesta (jeśli istnieje)
          const authToken = (req as any).authToken;

          // Uwaga: eventStore jest opcjonalny i wymagany tylko dla resumability
          // Na razie pomijamy go dla uproszczenia
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (newSessionId) => {
              log('info', `Sesja zainicjalizowana: ${newSessionId}`);
              transports.set(newSessionId, transport);
            },
          });

          // Obsługa zamknięcia transportu
          transport.onclose = () => {
            const sid = transport.sessionId;
            if (sid && transports.has(sid)) {
              log('info', `Transport zamknięty dla sesji ${sid}`);
              transports.delete(sid);
            }
          };

          // Połącz transport z serwerem MCP
          // Przekaż token z Authorization header (jeśli istnieje)
          const mcpServer = createMcpServer(apiClient, databaseClient, authToken);
          await mcpServer.connect(transport);
          await transport.handleRequest(req, res, req.body);
          return;
        } else {
          // Nieprawidłowe żądanie
          return res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: No valid session ID provided or not an initialize request',
            },
            id: null,
          });
        }

        // Obsłuż żądanie istniejącym transportem
        await transport.handleRequest(req, res, req.body);
        return;
      } catch (error) {
        log('error', 'Błąd podczas obsługi żądania MCP:', error);
        if (!res.headersSent) {
          return res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error',
            },
            id: null,
          });
        }
        return;
      }
    });

    /**
     * GET /mcp - Endpoint dla SSE stream (opcjonalny w Streamable HTTP)
     */
    app.get('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      if (!sessionId || !transports.has(sessionId)) {
        return res.status(400).send('Invalid or missing session ID');
      }

      const lastEventId = req.headers['last-event-id'] as string | undefined;
      if (lastEventId) {
        log('info', `Klient reconnecting z Last-Event-ID: ${lastEventId}`);
      } else {
        log('info', `Nowy SSE stream dla sesji ${sessionId}`);
      }

      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res);
      return;
    });

    /**
     * DELETE /mcp - Zakończenie sesji
     */
    app.delete('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      if (!sessionId || !transports.has(sessionId)) {
        return res.status(400).send('Invalid or missing session ID');
      }

      log('info', `Żądanie zakończenia sesji: ${sessionId}`);

      try {
        const transport = transports.get(sessionId)!;
        await transport.handleRequest(req, res);
        return;
      } catch (error) {
        log('error', 'Błąd podczas zamykania sesji:', error);
        if (!res.headersSent) {
          return res.status(500).send('Error processing session termination');
        }
        return;
      }
    });

    // Uruchom serwer
    app.listen(port, () => {
      log('info', `Express ERP MCP Server uruchomiony na porcie ${port}`);
      log('info', `Protocol: MCP Streamable HTTP (2025-06-18)`);
      log('info', `Health check: http://localhost:${port}/health`);
      log('info', `MCP endpoint: http://localhost:${port}/mcp`);
      log('info', `Test endpoint: POST http://localhost:${port}/test/verify-order`);
      log('info', 'Oczekiwanie na połączenia...');
    });

    // Graceful shutdown
    const shutdown = async () => {
      log('info', 'Zamykanie serwera...');

      // Zamknij wszystkie aktywne transporty
      for (const [sessionId, transport] of transports.entries()) {
        try {
          log('info', `Zamykanie transportu dla sesji ${sessionId}`);
          await transport.close();
          transports.delete(sessionId);
        } catch (error) {
          log('error', `Błąd zamykania transportu ${sessionId}:`, error);
        }
      }

      log('info', 'Serwer zamknięty');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    log('error', 'Krytyczny błąd podczas uruchamiania serwera:', error);

    if (error instanceof Error) {
      console.error(`\nBŁĄD: ${error.message}\n`);

      if (error.message.includes('SUPABASE_PROJECT_URL')) {
        console.error('Ustaw zmienną środowiskową SUPABASE_PROJECT_URL');
      } else if (error.message.includes('SUPABASE_BEARER_TOKEN')) {
        console.error('Ustaw zmienną środowiskową SUPABASE_BEARER_TOKEN');
      }
    }

    process.exit(1);
  }
}

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
