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
import { handleVerifyOrder } from './tools/orderVerification.js';

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
 */
function createMcpServer(apiClient: ApiClient): McpServer {
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
      const result = await handleVerifyOrder(apiClient, args);

      // Konwersja do właściwego typu
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

    // API Key Authentication Middleware (tylko dla /mcp endpoint)
    const MCP_API_KEY = process.env.MCP_API_KEY;
    const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
      // Pomiń autentykację dla health check i info endpoints
      if (req.path === '/health' || req.path === '/' || req.path === '/test/verify-order') {
        return next();
      }

      // Sprawdź API key w headerach
      const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

      if (!MCP_API_KEY) {
        // Jeśli MCP_API_KEY nie jest ustawiony, pomiń autentykację (development mode)
        log('info', 'MCP_API_KEY nie ustawiony - autentykacja wyłączona');
        return next();
      }

      if (!apiKey) {
        log('error', 'Brak API key w żądaniu');
        return res.status(401).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Unauthorized: API key required. Provide X-API-Key or Authorization header.',
          },
          id: null,
        });
      }

      if (apiKey !== MCP_API_KEY) {
        log('error', 'Nieprawidłowy API key');
        return res.status(403).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Forbidden: Invalid API key',
          },
          id: null,
        });
      }

      // API key poprawny
      next();
    };

    app.use(authMiddleware);

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
        tools: ['verify_order'],
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
          const mcpServer = createMcpServer(apiClient);
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

      if (error.message.includes('SUPABASE_URL')) {
        console.error('Ustaw zmienną środowiskową SUPABASE_URL');
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
