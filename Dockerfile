# Dockerfile dla Express ERP MCP Server
# Zoptymalizowany dla Google Cloud Run

# Etap 1: Builder
FROM node:18-alpine AS builder

# Metadane
LABEL maintainer="Express ERP MCP"
LABEL description="MCP Server dla systemu ERP - weryfikacja zamówień"

# Utwórz katalog roboczy
WORKDIR /app

# Skopiuj pliki package
COPY package*.json ./

# Zainstaluj zależności (tylko produkcyjne)
RUN npm ci --only=production && \
    npm cache clean --force

# Skopiuj kod źródłowy
COPY . .

# Zbuduj projekt TypeScript
RUN npm run build

# Etap 2: Runtime
FROM node:18-alpine

# Zainstaluj dumb-init do prawidłowej obsługi sygnałów
RUN apk add --no-cache dumb-init

# Utwórz użytkownika non-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Ustaw katalog roboczy
WORKDIR /app

# Skopiuj node_modules z buildera
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Skopiuj zbudowany kod
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Skopiuj package.json
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

# Przełącz na użytkownika non-root
USER nodejs

# Ustaw zmienne środowiskowe
ENV NODE_ENV=production
ENV PORT=8080

# Expose port (wymagane przez Cloud Run)
EXPOSE 8080

# Health check (opcjonalny)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "process.exit(0)" || exit 1

# Użyj dumb-init jako entry point
ENTRYPOINT ["dumb-init", "--"]

# Uruchom aplikację
CMD ["node", "dist/index.js"]
