# Quick Start Guide - Express ERP MCP Server

Szybki przewodnik uruchomienia serwera lokalnie w 5 minut.

## Wymagania

- Node.js 18+
- npm

## Krok 1: Instalacja (1 min)

```bash
cd Express_ERP_MCP
npm install
```

## Krok 2: Konfiguracja (1 min)

Plik `.env` już istnieje z poprawną konfiguracją:

```env
SUPABASE_URL=https://qqlfyuhupuqcingumhqm.supabase.co/functions/v1/order-verification
SUPABASE_BEARER_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Krok 3: Build (1 min)

```bash
npm run build
```

## Krok 4: Uruchomienie (30 sec)

```bash
npm start
```

Powinieneś zobaczyć:

```
[INFO] Express ERP MCP Server uruchomiony pomyślnie
[INFO] Oczekiwanie na żądania...
```

## Krok 5: Konfiguracja Claude Desktop (2 min)

1. Otwórz plik konfiguracji Claude Desktop:
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`

2. Dodaj konfigurację:

```json
{
  "mcpServers": {
    "express-erp": {
      "command": "node",
      "args": ["C:/Projekty/Agentic Coding Testing/MCP - ERP System - Szkolenie Agenci/Express_ERP_MCP/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://qqlfyuhupuqcingumhqm.supabase.co/functions/v1/order-verification",
        "SUPABASE_BEARER_TOKEN": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxbGZ5dWh1cHVxY2luZ3VtaHFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0NTY5NzUsImV4cCI6MjA3ODAzMjk3NX0.3F9aCqiP7a-gDMDAIPFjHNSS2IXPQo0B4fIU_WoVnCE"
      }
    }
  }
}
```

3. Zrestartuj Claude Desktop

## Test

W Claude napisz:

```
Sprawdź zamówienie OP1001
```

Powinieneś otrzymać szczegóły zamówienia.

## Przykładowe zamówienia do testów

- `OP1001` - Istniejące zamówienie (Anna Kowalska)
- `OP9999` - Nieistniejące zamówienie (do testów błędów)

## Tryb developerski

Dla rozwoju z hot reload:

```bash
npm run dev
```

## Deployment w chmurze

Szczegółowe instrukcje w pliku [DEPLOYMENT.md](./DEPLOYMENT.md)

### Railway (najprostsze)

1. Push do GitHub
2. Połącz z Railway
3. Dodaj zmienne środowiskowe
4. Deploy automatyczny

### Google Cloud Run

1. `gcloud builds submit --tag gcr.io/PROJECT_ID/express-erp-mcp`
2. `gcloud run deploy express-erp-mcp --image gcr.io/PROJECT_ID/express-erp-mcp`

## Pomoc

- Pełna dokumentacja: [README.md](./README.md)
- Instrukcje deployment: [DEPLOYMENT.md](./DEPLOYMENT.md)
- Plan projektu: [../plan.md](../plan.md)

---

**Gotowe!** Serwer MCP jest uruchomiony i gotowy do użycia. 🚀
