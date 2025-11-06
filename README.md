# Express ERP MCP Server

Serwer MCP (Model Context Protocol) dla systemu ERP umożliwiający agentom AI weryfikację zamówień poprzez API Supabase.

## Funkcje

- ✅ Weryfikacja istnienia zamówień w systemie ERP
- ✅ Pobieranie szczegółowych informacji o zamówieniach
- ✅ Obsługa błędów i retry logic
- ✅ Timeout handling
- ✅ Wsparcie dla deploymentu lokalnego i w chmurze (Railway, Google Cloud Run)

## Wymagania

- Node.js 18 lub nowszy
- npm lub yarn
- Dostęp do API Supabase ERP

## Instalacja Lokalna

### 1. Sklonuj repozytorium

```bash
git clone <repository-url>
cd Express_ERP_MCP
```

### 2. Zainstaluj zależności

```bash
npm install
```

### 3. Konfiguracja

Skopiuj plik `.env.example` do `.env`:

```bash
cp .env.example .env
```

Edytuj plik `.env` i uzupełnij wymagane dane:

```env
SUPABASE_URL=https://qqlfyuhupuqcingumhqm.supabase.co/functions/v1/order-verification
SUPABASE_BEARER_TOKEN=twój_token_tutaj
NODE_ENV=development
API_TIMEOUT=5000
LOG_LEVEL=info
```

### 4. Zbuduj projekt

```bash
npm run build
```

### 5. Uruchom serwer

```bash
npm start
```

Lub w trybie developerskim z hot reload:

```bash
npm run dev
```

## Konfiguracja w Claude Desktop

Aby używać serwera MCP z Claude Desktop, dodaj konfigurację do `claude_desktop_config.json`:

### Dla serwera lokalnego

```json
{
  "mcpServers": {
    "express-erp": {
      "command": "node",
      "args": ["C:/path/to/Express_ERP_MCP/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://qqlfyuhupuqcingumhqm.supabase.co/functions/v1/order-verification",
        "SUPABASE_BEARER_TOKEN": "twój_token_tutaj"
      }
    }
  }
}
```

### Dla serwera w chmurze (Railway/Google Cloud Run)

```json
{
  "mcpServers": {
    "express-erp": {
      "url": "https://your-server-url.app/sse",
      "transport": "sse"
    }
  }
}
```

## Deployment

### Opcja A: Railway

Railway oferuje najprostszy deployment z automatyczną integracją GitHub.

#### Kroki:

1. **Zaloguj się do Railway**
   - Przejdź na [railway.app](https://railway.app/)
   - Zaloguj się przez GitHub

2. **Utwórz nowy projekt**
   - Kliknij "New Project"
   - Wybierz "Deploy from GitHub repo"
   - Wybierz repozytorium Express_ERP_MCP

3. **Skonfiguruj zmienne środowiskowe**
   - W panelu projektu przejdź do zakładki "Variables"
   - Dodaj następujące zmienne:
     - `SUPABASE_URL`
     - `SUPABASE_BEARER_TOKEN`
     - `NODE_ENV=production`

4. **Deploy**
   - Railway automatycznie zbuduje i wdroży aplikację
   - Otrzymasz publiczny URL

#### Automatyczne deploymenty

Railway automatycznie deployuje przy każdym push do głównej gałęzi.

### Opcja B: Google Cloud Run

Google Cloud Run oferuje serverless deployment z auto-scalingiem.

#### Wymagania:
- Konto Google Cloud
- Zainstalowane `gcloud` CLI

#### Kroki:

1. **Zaloguj się do Google Cloud**

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

2. **Włącz wymagane API**

```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
```

3. **Zbuduj i wyślij obraz do Container Registry**

```bash
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/express-erp-mcp
```

4. **Wdróż na Cloud Run**

```bash
gcloud run deploy express-erp-mcp \
  --image gcr.io/YOUR_PROJECT_ID/express-erp-mcp \
  --platform managed \
  --region europe-central2 \
  --allow-unauthenticated \
  --set-env-vars SUPABASE_URL="https://qqlfyuhupuqcingumhqm.supabase.co/functions/v1/order-verification" \
  --set-env-vars SUPABASE_BEARER_TOKEN="your_token_here" \
  --set-env-vars NODE_ENV="production"
```

5. **Otrzymasz URL**
   - Cloud Run zwróci publiczny URL serwisu
   - Np. `https://express-erp-mcp-xxxxx-uc.a.run.app`

## Narzędzia MCP

### `verify_order`

Weryfikuje istnienie zamówienia w systemie ERP i pobiera szczegóły.

**Parametry:**
- `numer_zamowienia` (string, wymagany) - Numer zamówienia do weryfikacji (np. "OP1001")

**Przykład użycia w Claude:**

```
Sprawdź zamówienie OP1001
```

**Odpowiedź dla istniejącego zamówienia:**

```
✓ Zamówienie zostało znalezione w systemie

📦 SZCZEGÓŁY ZAMÓWIENIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Numer zamówienia: OP1001
• ID zamówienia: 1a2b7eaa-fbae-46a0-b3ce-896654acb814
• Status: dostarczone
• Wartość całkowita: 1476 PLN

👤 DANE KLIENTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Imię i nazwisko: Anna Kowalska
• Email: anna.k101@example.com
```

**Odpowiedź dla nieistniejącego zamówienia:**

```
✗ Zamówienie "OP9999" nie zostało znalezione w systemie

Możliwe przyczyny:
• Numer zamówienia został wpisany nieprawidłowo
• Zamówienie nie istnieje w systemie
• Zamówienie zostało usunięte
```

## API Reference

### Struktura odpowiedzi API

```typescript
interface OrderVerificationResponse {
  zamowienieIstnieje: boolean;
  daneZamowienia: {
    id_zamowienia: string;
    numer_zamowienia: string;
    status: string;
    wartosc_calkowita: number;
    klient: {
      imie: string;
      nazwisko: string;
      email: string;
    };
  } | null;
}
```

## Obsługa błędów

Serwer obsługuje następujące typy błędów:

- **400** - Nieprawidłowe żądanie (błędny format numeru)
- **401** - Błąd autoryzacji (nieprawidłowy token)
- **408** - Timeout (przekroczono limit czasu)
- **429** - Rate limiting (zbyt wiele żądań)
- **500+** - Błędy serwera API

Wszystkie błędy są automatycznie retry'owane z exponential backoff dla błędów przejściowych.

## Bezpieczeństwo

### Najlepsze praktyki:

1. **Nigdy nie commituj tokenu** do repozytorium Git
2. **Używaj zmiennych środowiskowych** dla wrażliwych danych
3. **Regularnie rotuj tokeny** (co 90 dni)
4. **Monitoruj logi** pod kątem nieautoryzowanego dostępu
5. **Używaj HTTPS** w produkcji

### Rate Limiting

API może mieć limity żądań. Serwer automatycznie obsługuje retry w przypadku kodu 429.

## Troubleshooting

### Problem: "SUPABASE_URL environment variable is required"

**Rozwiązanie:** Upewnij się, że ustawiłeś zmienną środowiskową `SUPABASE_URL` w pliku `.env` lub w konfiguracji cloud providera.

### Problem: "Błąd autoryzacji - nieprawidłowy token"

**Rozwiązanie:** Sprawdź czy token Bearer w zmiennej `SUPABASE_BEARER_TOKEN` jest poprawny.

### Problem: "Przekroczono limit czasu żądania"

**Rozwiązanie:** Sprawdź połączenie sieciowe lub zwiększ wartość `API_TIMEOUT` w konfiguracji.

### Problem: Serwer nie odpowiada

**Rozwiązanie:**
1. Sprawdź czy wszystkie zależności są zainstalowane: `npm install`
2. Zbuduj projekt ponownie: `npm run build`
3. Sprawdź logi błędów w konsoli

## Rozwój

### Uruchomienie w trybie developerskim

```bash
npm run dev
```

### Linting

```bash
npm run lint
```

### Czyszczenie buildu

```bash
npm run clean
```

## Struktura projektu

```
Express_ERP_MCP/
├── src/
│   ├── index.ts              # Główny serwer MCP
│   ├── config/
│   │   └── index.ts          # Konfiguracja
│   ├── services/
│   │   └── apiClient.ts      # Klient API
│   ├── tools/
│   │   └── orderVerification.ts  # Narzędzie MCP
│   └── types/
│       └── index.ts          # Typy TypeScript
├── dist/                     # Zbudowane pliki (generowane)
├── tests/                    # Testy (przyszłe)
├── .env.example             # Przykładowa konfiguracja
├── .gitignore
├── Dockerfile               # Dla Google Cloud Run
├── railway.json             # Konfiguracja Railway
├── package.json
├── tsconfig.json
└── README.md
```

## Zmienne środowiskowe

| Zmienna | Wymagana | Domyślna | Opis |
|---------|----------|----------|------|
| `SUPABASE_URL` | ✅ | - | URL endpointu API Supabase |
| `SUPABASE_BEARER_TOKEN` | ✅ | - | Token autoryzacyjny Bearer |
| `NODE_ENV` | ❌ | `development` | Środowisko (development/production) |
| `API_TIMEOUT` | ❌ | `5000` | Timeout API w milisekundach |
| `LOG_LEVEL` | ❌ | `info` | Poziom logowania |
| `PORT` | ❌ | `3000` | Port dla HTTP transport (cloud) |

## Licencja

MIT

## Wsparcie

W przypadku problemów lub pytań, utwórz issue w repozytorium GitHub.

---

**Wersja:** 1.0.0
**Ostatnia aktualizacja:** 2025-01-06
