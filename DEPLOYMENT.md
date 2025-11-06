# Instrukcje Deployment - Express ERP MCP Server

Ten dokument zawiera szczegółowe instrukcje wdrażania serwera Express ERP MCP na platformach Railway i Google Cloud Run.

---

## Spis treści

1. [Deployment na Railway](#deployment-na-railway)
2. [Deployment na Google Cloud Run](#deployment-na-google-cloud-run)
3. [Testowanie po deployment](#testowanie-po-deployment)
4. [Troubleshooting](#troubleshooting)

---

## Deployment na Railway

Railway to platforma oferująca najprostszy sposób deployment z automatyczną integracją GitHub.

### Krok 1: Przygotowanie repozytorium

1. **Utwórz repozytorium GitHub** (jeśli jeszcze nie istnieje):

```bash
cd Express_ERP_MCP
git init
git add .
git commit -m "Initial commit: Express ERP MCP Server"
```

2. **Utwórz zdalne repozytorium** na GitHub i wypchnij kod:

```bash
git remote add origin https://github.com/your-username/Express_ERP_MCP.git
git branch -M main
git push -u origin main
```

### Krok 2: Tworzenie projektu na Railway

1. Przejdź na [railway.app](https://railway.app/)
2. Kliknij **"Login"** i zaloguj się przez GitHub
3. Kliknij **"New Project"**
4. Wybierz **"Deploy from GitHub repo"**
5. Wybierz repozytorium `Express_ERP_MCP`
6. Railway automatycznie wykryje projekt Node.js

### Krok 3: Konfiguracja zmiennych środowiskowych

1. W panelu projektu Railway kliknij na swój serwis
2. Przejdź do zakładki **"Variables"**
3. Dodaj następujące zmienne:

```
SUPABASE_URL=https://qqlfyuhupuqcingumhqm.supabase.co/functions/v1/order-verification
SUPABASE_BEARER_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxbGZ5dWh1cHVxY2luZ3VtaHFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0NTY5NzUsImV4cCI6MjA3ODAzMjk3NX0.3F9aCqiP7a-gDMDAIPFjHNSS2IXPQo0B4fIU_WoVnCE
NODE_ENV=production
API_TIMEOUT=5000
LOG_LEVEL=info
```

4. Kliknij **"Add"** dla każdej zmiennej

### Krok 4: Deploy

1. Railway automatycznie rozpocznie deployment po dodaniu zmiennych
2. Możesz śledzić postęp w zakładce **"Deployments"**
3. Po zakończeniu deployment zobaczysz status **"Success"**

### Krok 5: Otrzymanie URL

1. Kliknij na swój serwis w Railway
2. Przejdź do zakładki **"Settings"**
3. W sekcji **"Networking"** kliknij **"Generate Domain"**
4. Otrzymasz publiczny URL, np. `express-erp-mcp-production.up.railway.app`

### Krok 6: Weryfikacja

Sprawdź logi w zakładce **"Logs"**, powinien pojawić się komunikat:

```
[INFO] Express ERP MCP Server uruchomiony pomyślnie
[INFO] Oczekiwanie na żądania...
```

### Automatyczne deploymenty

Railway automatycznie wdraża nowe wersje przy każdym push do gałęzi `main`:

```bash
git add .
git commit -m "Update feature"
git push origin main
```

---

## Deployment na Google Cloud Run

Google Cloud Run oferuje serverless deployment z auto-scalingiem i pay-per-use.

### Wymagania wstępne

1. **Konto Google Cloud Platform**
   - Utwórz konto na [cloud.google.com](https://cloud.google.com/)
   - Włącz billing (potrzebna karta kredytowa, ale jest darmowy tier)

2. **Google Cloud SDK**
   - Pobierz z [cloud.google.com/sdk](https://cloud.google.com/sdk/docs/install)
   - Zainstaluj zgodnie z instrukcjami dla Windows

3. **Docker Desktop** (opcjonalnie, do testów lokalnych)
   - Pobierz z [docker.com](https://www.docker.com/products/docker-desktop/)

### Krok 1: Konfiguracja gcloud CLI

1. Otwórz PowerShell lub Command Prompt

2. Zainicjalizuj gcloud:

```bash
gcloud init
```

3. Zaloguj się:

```bash
gcloud auth login
```

4. Utwórz nowy projekt lub wybierz istniejący:

```bash
# Utwórz nowy projekt
gcloud projects create express-erp-mcp --name="Express ERP MCP"

# Ustaw jako aktywny
gcloud config set project express-erp-mcp
```

5. Włącz billing dla projektu (w konsoli web):
   - Przejdź do [console.cloud.google.com/billing](https://console.cloud.google.com/billing)
   - Połącz projekt z kontem billing

### Krok 2: Włączenie wymaganych API

```bash
# Włącz Cloud Build API
gcloud services enable cloudbuild.googleapis.com

# Włącz Cloud Run API
gcloud services enable run.googleapis.com

# Włącz Container Registry API
gcloud services enable containerregistry.googleapis.com
```

### Krok 3: Build i push obrazu Docker

1. Upewnij się, że jesteś w katalogu projektu:

```bash
cd C:\Projekty\Agentic Coding Testing\MCP - ERP System - Szkolenie Agenci\Express_ERP_MCP
```

2. Zbuduj i wypchnij obraz do Google Container Registry:

```bash
gcloud builds submit --tag gcr.io/express-erp-mcp/express-erp-mcp
```

To polecenie:
- Uploaduje kod źródłowy do Cloud Build
- Buduje obraz Docker na podstawie Dockerfile
- Pushuje obraz do Container Registry

**Uwaga:** Ten proces może potrwać 3-5 minut przy pierwszym uruchomieniu.

### Krok 4: Deploy na Cloud Run

Deploy serwisu z konfiguracją:

```bash
gcloud run deploy express-erp-mcp \
  --image gcr.io/express-erp-mcp/express-erp-mcp \
  --platform managed \
  --region europe-central2 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars SUPABASE_URL="https://qqlfyuhupuqcingumhqm.supabase.co/functions/v1/order-verification" \
  --set-env-vars SUPABASE_BEARER_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxbGZ5dWh1cHVxY2luZ3VtaHFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0NTY5NzUsImV4cCI6MjA3ODAzMjk3NX0.3F9aCqiP7a-gDMDAIPFjHNSS2IXPQo0B4fIU_WoVnCE" \
  --set-env-vars NODE_ENV="production" \
  --set-env-vars API_TIMEOUT="5000"
```

**Parametry:**
- `--region europe-central2` - Region w Polsce (Warszawa)
- `--allow-unauthenticated` - Zezwala na publiczny dostęp
- `--memory 512Mi` - 512MB RAM
- `--cpu 1` - 1 vCPU
- `--min-instances 0` - Scale down do 0 gdy brak ruchu (oszczędność kosztów)
- `--max-instances 10` - Maksymalnie 10 instancji

### Krok 5: Otrzymanie URL

Po zakończeniu deployment otrzymasz URL typu:

```
https://express-erp-mcp-xxxxx-uc.a.run.app
```

### Krok 6: Weryfikacja

Sprawdź logi:

```bash
gcloud run services logs read express-erp-mcp --region europe-central2
```

Lub w konsoli web:
- Przejdź do [console.cloud.google.com/run](https://console.cloud.google.com/run)
- Kliknij na serwis `express-erp-mcp`
- Zakładka **"Logs"**

### Update deployment

Przy każdej zmianie kodu powtórz kroki 3 i 4:

```bash
# Build i push nowego obrazu
gcloud builds submit --tag gcr.io/express-erp-mcp/express-erp-mcp

# Deploy update
gcloud run deploy express-erp-mcp \
  --image gcr.io/express-erp-mcp/express-erp-mcp \
  --platform managed \
  --region europe-central2
```

### Zarządzanie kosztami

Cloud Run jest serverless - płacisz tylko za faktyczne użycie:
- Pierwsze 2 miliony żądań miesięcznie: **DARMOWE**
- 180,000 vCPU-sekund miesięcznie: **DARMOWE**
- 360,000 GiB-sekund pamięci miesięcznie: **DARMOWE**

Przy małym ruchu serwis będzie praktycznie darmowy dzięki `--min-instances 0`.

---

## Testowanie po deployment

### Test lokalny przed deployment

```bash
# Uruchom lokalnie
cd Express_ERP_MCP
npm run dev
```

W osobnym terminalu:

```bash
# Test z Claude Desktop
# Skonfiguruj claude_desktop_config.json jak w README.md
```

### Test serwera w chmurze

Po deployment sprawdź czy serwis odpowiada:

#### Railway:

```bash
curl https://your-app.railway.app/health
```

#### Google Cloud Run:

```bash
curl https://express-erp-mcp-xxxxx-uc.a.run.app/health
```

### Test narzędzia MCP

Skonfiguruj Claude Desktop z URL serwera:

```json
{
  "mcpServers": {
    "express-erp": {
      "url": "https://your-server-url/sse",
      "transport": "sse"
    }
  }
}
```

Następnie w Claude:

```
Sprawdź zamówienie OP1001
```

---

## Troubleshooting

### Railway

**Problem:** Build fails z błędem "Cannot find module"

**Rozwiązanie:**
- Sprawdź czy `package.json` zawiera wszystkie zależności
- Uruchom `npm install` lokalnie i commitnij `package-lock.json`

**Problem:** Serwis crashuje po starcie

**Rozwiązanie:**
- Sprawdź logi w zakładce "Logs"
- Upewnij się że wszystkie zmienne środowiskowe są ustawione
- Sprawdź czy `railway.json` ma poprawny `startCommand`

**Problem:** "Port already in use"

**Rozwiązanie:**
- Railway automatycznie przypisuje port - nie hardcoduj portu w kodzie
- Użyj `process.env.PORT` jeśli serwer potrzebuje HTTP portu

### Google Cloud Run

**Problem:** "Permission denied" podczas `gcloud builds submit`

**Rozwiązanie:**
```bash
# Włącz API ponownie
gcloud services enable cloudbuild.googleapis.com

# Sprawdź uprawnienia
gcloud projects get-iam-policy express-erp-mcp
```

**Problem:** Build timeout

**Rozwiązanie:**
```bash
# Zwiększ timeout buildu
gcloud builds submit --timeout=20m --tag gcr.io/express-erp-mcp/express-erp-mcp
```

**Problem:** Container fails to start

**Rozwiązanie:**
- Sprawdź logi: `gcloud run services logs read express-erp-mcp`
- Upewnij się że `Dockerfile` używa portu 8080 (wymagane przez Cloud Run)
- Sprawdź czy zmienne środowiskowe są ustawione

**Problem:** "Service unavailable" 503

**Rozwiązanie:**
- Sprawdź czy container nasłuchuje na porcie `$PORT`
- Zwiększ timeout startu:
```bash
gcloud run services update express-erp-mcp \
  --timeout=300 \
  --region europe-central2
```

**Problem:** Wysokie koszty

**Rozwiązanie:**
- Ustaw `--min-instances 0` aby scale down do zera
- Ogranicz `--max-instances` do rozsądnej wartości (np. 5)
- Monitoruj użycie w konsoli Cloud Run

### Ogólne

**Problem:** API timeout

**Rozwiązanie:**
- Zwiększ `API_TIMEOUT` w zmiennych środowiskowych
- Sprawdź połączenie sieciowe z serwera do Supabase API

**Problem:** 401 Unauthorized z API

**Rozwiązanie:**
- Sprawdź czy `SUPABASE_BEARER_TOKEN` jest poprawny
- Token może wygasnąć - sprawdź pole `exp` w tokenie JWT

**Problem:** Narzędzie nie pojawia się w Claude

**Rozwiązanie:**
- Zrestartuj Claude Desktop po zmianie konfiguracji
- Sprawdź logi serwera czy połączenie zostało nawiązane
- Upewnij się że URL serwera jest poprawny

---

## Monitorowanie

### Railway

- Logi: Zakładka "Logs" w dashboardzie
- Metryki: Zakładka "Metrics" (CPU, RAM, Network)
- Alerty: Można skonfigurować w Settings

### Google Cloud Run

- Logi: `gcloud run services logs read express-erp-mcp --region europe-central2`
- Metryki: [console.cloud.google.com/run](https://console.cloud.google.com/run)
- Alerty: Cloud Monitoring w GCP console

---

## Następne kroki

Po udanym deployment:

1. **Monitorowanie** - Skonfiguruj alerty dla downtime
2. **Backup** - Zapisz zmienne środowiskowe w bezpiecznym miejscu
3. **Dokumentacja** - Udokumentuj custom konfigurację
4. **Testing** - Testuj regularnie z prawdziwymi danymi
5. **Updates** - Planuj regularne aktualizacje zależności

---

**Powodzenia z deploymentem!** 🚀

W razie problemów sprawdź logi i sekcję Troubleshooting powyżej.
