# ── Stage 1: Builder ─────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (bcrypt, etc.)
RUN apk add --no-cache python3 make g++

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace root package files first for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./

# Copy each package's package.json before source for dep caching
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Copy tsconfig files (per-package)
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/server/tsconfig.json ./packages/server/
COPY packages/client/tsconfig.json ./packages/client/
COPY packages/client/vite.config.ts ./packages/client/
COPY packages/client/tailwind.config.js ./packages/client/
COPY packages/client/postcss.config.js ./packages/client/

# Copy source code
COPY packages/shared/src/ ./packages/shared/src/
COPY packages/server/src/ ./packages/server/src/
COPY packages/client/src/ ./packages/client/src/
COPY packages/client/index.html ./packages/client/

# Build all packages in order (shared first, then server + client)
RUN pnpm --filter @emp-billing/shared run build && \
    pnpm --filter @emp-billing/server run build && \
    pnpm --filter @emp-billing/client run build

# ── Stage 2: Production ─────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    dumb-init \
    netcat-openbsd

# Tell Puppeteer to use installed Chromium instead of downloading
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    NODE_ENV=production

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace root package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts from builder
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/client/dist ./packages/client/dist

# Copy server templates (Handlebars for PDF/email)
COPY packages/server/src/templates ./packages/server/src/templates

# Copy entrypoint and fix line endings (Windows CRLF → Unix LF)
COPY docker/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh && \
    chmod +x /usr/local/bin/docker-entrypoint.sh

# Create non-root user
RUN addgroup -S billing && adduser -S billing -G billing
RUN mkdir -p /app/uploads && chown -R billing:billing /app
USER billing

EXPOSE 4001

ENTRYPOINT ["dumb-init", "--"]
CMD ["docker-entrypoint.sh"]
