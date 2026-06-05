# ─── Stage 1: Dependências ──────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ─── Stage 2: Imagem final ──────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Segurança: rodar como usuário não-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Copiar apenas o necessário
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=appuser:appgroup . .

# Variáveis de ambiente (os valores reais vêm do .env ou da plataforma de nuvem)
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Healthcheck para orquestradores (Docker, Railway, Render, K8s)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "src/server.js"]
