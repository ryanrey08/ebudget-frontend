# ─────────────────────────────────────────────────────────────────────────────
# eBudget frontend: production image (multi-stage, Next.js standalone output).
#
#   deps    → npm ci from package-lock.json (cached until package*.json change)
#   builder → next build with NEXT_OUTPUT=standalone
#   runner  → node + .next/standalone + .next/static + public, as user `node`
#
# NEXT_PUBLIC_* values are inlined into the browser bundle by `next build`, so
# they are BUILD ARGS here: changing one means rebuilding the image. Server-only
# settings (BACKEND_API_URL, BACKEND_SYSTEM, ...) are read at RUNTIME from the
# container environment. See docker/README.md.
# ─────────────────────────────────────────────────────────────────────────────

ARG NODE_IMAGE=node:22-alpine

# ── 1. Dependencies ──────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS deps
# libc6-compat: glibc shims some native Node modules expect on Alpine (musl).
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# ── 2. Build ─────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Public (browser-visible) build-time configuration. Never put secrets here.
ARG NEXT_PUBLIC_API_MODE=mock
ARG NEXT_PUBLIC_AUTH_MODE=real
ARG NEXT_PUBLIC_API_BASE_URL=/api/backend
ARG NEXT_PUBLIC_API_TIMEOUT_MS=30000
ARG NEXT_PUBLIC_API_WITH_CREDENTIALS=true
ARG NEXT_PUBLIC_MOCK_API_DELAY_MS=150
ARG NEXT_PUBLIC_MOCK_API_FAILURE_RATE=0
ARG NEXT_PUBLIC_MOCK_API_PERSIST=false

ENV NEXT_PUBLIC_API_MODE=$NEXT_PUBLIC_API_MODE \
    NEXT_PUBLIC_AUTH_MODE=$NEXT_PUBLIC_AUTH_MODE \
    NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_API_TIMEOUT_MS=$NEXT_PUBLIC_API_TIMEOUT_MS \
    NEXT_PUBLIC_API_WITH_CREDENTIALS=$NEXT_PUBLIC_API_WITH_CREDENTIALS \
    NEXT_PUBLIC_MOCK_API_DELAY_MS=$NEXT_PUBLIC_MOCK_API_DELAY_MS \
    NEXT_PUBLIC_MOCK_API_FAILURE_RATE=$NEXT_PUBLIC_MOCK_API_FAILURE_RATE \
    NEXT_PUBLIC_MOCK_API_PERSIST=$NEXT_PUBLIC_MOCK_API_PERSIST \
    NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

# Output tracing also copies `typescript` (a devDependency, only needed to read
# next.config.ts at build time) into the standalone bundle; the server never
# loads it, so drop it from the runtime image.
RUN npm run build \
 && rm -rf .next/standalone/node_modules/typescript

# ── 3. Runtime ───────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# The official image ships an unprivileged `node` user (uid/gid 1000).
# standalone = server.js + the minimal node_modules it traces; static assets
# and public/ are not part of it and must be copied next to it.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node
EXPOSE 3000

# /login is a real, backend-independent page; any non-2xx/3xx fails the check.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/login" || exit 1

CMD ["node", "server.js"]
