# Instrukcje GitHub - Express ERP MCP Server

Lokalne repozytorium Git zostało już utworzone. Aby wypchnąć kod na GitHub, wykonaj poniższe kroki.

---

## Krok 1: Utwórz repozytorium na GitHub

### Opcja A: Przez przeglądarkę (najłatwiejsze)

1. Przejdź na [github.com](https://github.com/)
2. Zaloguj się na swoje konto
3. Kliknij **"+"** w prawym górnym rogu
4. Wybierz **"New repository"**
5. Wypełnij formularz:
   - **Repository name:** `Express_ERP_MCP`
   - **Description:** `Serwer MCP dla systemu ERP - weryfikacja zamówień`
   - **Visibility:** `Public` lub `Private` (według preferencji)
   - **⚠️ WAŻNE:** NIE zaznaczaj "Add a README file" (mamy już README)
   - **⚠️ WAŻNE:** NIE dodawaj .gitignore (mamy już .gitignore)
   - **⚠️ WAŻNE:** NIE dodawaj licencji na ten moment
6. Kliknij **"Create repository"**

### Opcja B: Przez GitHub CLI (dla zaawansowanych)

```bash
# Zainstaluj GitHub CLI: https://cli.github.com/
gh repo create Express_ERP_MCP --public --source=. --remote=origin --push
```

---

## Krok 2: Połącz lokalne repozytorium z GitHub

Po utworzeniu repozytorium na GitHub, otrzymasz URL. Wykonaj poniższe komendy w katalogu projektu:

### Dla HTTPS (zalecane dla większości użytkowników):

```bash
cd "C:\Projekty\Agentic Coding Testing\MCP - ERP System - Szkolenie Agenci\Express_ERP_MCP"

# Dodaj zdalne repozytorium
git remote add origin https://github.com/YOUR_USERNAME/Express_ERP_MCP.git

# Ustaw nazwę głównej gałęzi na 'main'
git branch -M main

# Wypchnij kod na GitHub
git push -u origin main
```

**Uwaga:** Zamień `YOUR_USERNAME` na swoją nazwę użytkownika GitHub.

### Dla SSH (dla użytkowników z skonfigurowanym SSH):

```bash
cd "C:\Projekty\Agentic Coding Testing\MCP - ERP System - Szkolenie Agenci\Express_ERP_MCP"

# Dodaj zdalne repozytorium
git remote add origin git@github.com:YOUR_USERNAME/Express_ERP_MCP.git

# Ustaw nazwę głównej gałęzi na 'main'
git branch -M main

# Wypchnij kod na GitHub
git push -u origin main
```

---

## Krok 3: Weryfikacja

Po wypchnięciu, odśwież stronę repozytorium na GitHub. Powinieneś zobaczyć:

- ✅ 15 plików
- ✅ README.md wyświetlony na stronie głównej
- ✅ 1 commit: "Initial commit: Express ERP MCP Server"
- ✅ Katalogi: src/, .github (jeśli dodane), dokumentacja

---

## Podstawowe komendy Git

### Dodanie nowych zmian

```bash
# Sprawdź status
git status

# Dodaj zmienione pliki
git add .

# Utwórz commit
git commit -m "Opis zmian"

# Wypchnij na GitHub
git push
```

### Sprawdzenie historii

```bash
# Historia commitów
git log --oneline

# Szczegółowa historia
git log
```

### Praca z gałęziami

```bash
# Utwórz nową gałąź
git checkout -b feature/nowa-funkcja

# Przełącz się między gałęziami
git checkout main

# Zobacz wszystkie gałęzie
git branch -a
```

---

## Deployment z GitHub

### Railway

Railway automatycznie wykryje repozytorium GitHub:

1. Przejdź na [railway.app](https://railway.app/)
2. Kliknij **"New Project"**
3. Wybierz **"Deploy from GitHub repo"**
4. Wybierz `Express_ERP_MCP`
5. Dodaj zmienne środowiskowe:
   - `SUPABASE_URL`
   - `SUPABASE_BEARER_TOKEN`
   - `NODE_ENV=production`
6. Railway automatycznie zbuduje i wdroży aplikację

**Automatyczne deploymenty:**
Każdy push do gałęzi `main` automatycznie wyzwoli nowy deployment.

### Google Cloud Run z Cloud Build

Połącz Cloud Build z GitHub:

1. Przejdź do [console.cloud.google.com/cloud-build/triggers](https://console.cloud.google.com/cloud-build/triggers)
2. Kliknij **"Create Trigger"**
3. Połącz repozytorium GitHub
4. Wybierz `Express_ERP_MCP`
5. Konfiguracja:
   - **Branch:** `^main$`
   - **Build configuration:** Dockerfile
   - **Dockerfile path:** `Dockerfile`
6. Zapisz

Teraz każdy push do `main` automatycznie:
- Zbuduje obraz Docker
- Wdroży na Cloud Run

---

## Gitignore - Co jest ignorowane

Plik `.gitignore` zapewnia, że następujące pliki NIE są commitowane:

✅ **Ignorowane (bezpiecznie):**
- `node_modules/` - Zależności (pobierane przez npm install)
- `dist/` - Pliki zbudowane (generowane przez npm run build)
- `.env` - Wrażliwe dane (tokeny, hasła)
- `*.log` - Logi

❌ **Commitowane (potrzebne):**
- `.env.example` - Przykładowa konfiguracja (bez wrażliwych danych)
- `src/` - Kod źródłowy
- `package.json` - Zależności projektu
- `tsconfig.json` - Konfiguracja TypeScript
- `Dockerfile` - Instrukcje buildu
- Dokumentacja

---

## Bezpieczeństwo

### ⚠️ WAŻNE: Nigdy nie commituj wrażliwych danych

**Sprawdź przed każdym pushem:**

```bash
# Sprawdź co zostanie commitowane
git diff --staged

# Sprawdź historię commitów
git log -p
```

**Jeśli przypadkowo commitowałeś .env z tokenem:**

```bash
# NATYCHMIAST rotuj token w Supabase!
# Następnie usuń z historii:
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# Wymuś push
git push origin --force --all
```

### Secrets w GitHub Actions

Jeśli używasz GitHub Actions, dodaj secrets:

1. Repozytorium → **Settings** → **Secrets and variables** → **Actions**
2. Kliknij **"New repository secret"**
3. Dodaj:
   - Name: `SUPABASE_BEARER_TOKEN`
   - Value: `your_token_here`

---

## Współpraca

### Fork i Pull Request workflow

**Dla współpracowników:**

1. Fork repozytorium
2. Sklonuj swojego forka
3. Utwórz gałąź: `git checkout -b feature/nazwa-funkcji`
4. Commituj zmiany: `git commit -m "Dodaj nową funkcję"`
5. Push do forka: `git push origin feature/nazwa-funkcji`
6. Utwórz Pull Request na GitHub

**Dla maintainera:**

1. Review Pull Request
2. Uruchom testy (jeśli są)
3. Merge jeśli wszystko OK

---

## Pomocne linki

- **GitHub Docs:** [docs.github.com](https://docs.github.com/)
- **Git Docs:** [git-scm.com/doc](https://git-scm.com/doc)
- **GitHub CLI:** [cli.github.com](https://cli.github.com/)
- **Railway Docs:** [docs.railway.app](https://docs.railway.app/)

---

## Status repozytorium

**Aktualne informacje:**

```bash
# Branch: main
# Last commit: 44cae87 - Initial commit: Express ERP MCP Server
# Files: 15
# Lines: 1738
# Remote: (do skonfigurowania)
```

---

## Następne kroki

1. ✅ Utwórz repozytorium na GitHub
2. ✅ Połącz lokalne repozytorium z GitHub (`git remote add origin`)
3. ✅ Wypchnij kod (`git push -u origin main`)
4. ⏳ Skonfiguruj deployment na Railway lub Google Cloud Run
5. ⏳ Dodaj GitHub Actions dla CI/CD (opcjonalnie)
6. ⏳ Skonfiguruj branch protection rules (opcjonalnie)

---

**Powodzenia!** 🚀

W razie problemów sprawdź dokumentację Git lub GitHub Docs.
