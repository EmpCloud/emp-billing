# ── Stage 1: Builder ─────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (bcrypt, puppeteer, etc.)
RUN apk add --no-cache python3 make g++

# Copy workspace root package files first for layer caching
COPY package.json package-lock.json* ./

# Copy each package's package.json before source for dep caching
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/

# Install all dependencies (including devDependencies for build)
RUN npm install --ignore-scripts && npm rebuild

# Copy source code
COPY packages/shared/ ./packages/shared/
COPY packages/server/ ./packages/server/
COPY packages/client/ ./packages/client/
COPY tsconfig*.json ./

# Build all packages (shared first, then server + client)
RUN npm run build --workspace=packages/shared && \
    npm run build --workspace=packages/server && \
    npm run build --workspace=packages/client

# ── Stage 2: Production ─────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Install runtime dependencies for Puppeteer (PDF generation)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    dumb-init

# Tell Puppeteer to use installed Chromium instead of downloading
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    NODE_ENV=production

# Copy workspace root package files
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/

# Install production dependencies only
RUN npm install --omit=dev --ignore-scripts && npm rebuild

# Copy built artifacts from builder
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/client/dist ./packages/client/dist

# Copy server templates (Handlebars for PDF/email)
COPY packages/server/src/templates ./packages/server/src/templates

# Copy entrypoint
COPY docker/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create non-root user
RUN addgroup -S billing && adduser -S billing -G billing
RUN mkdir -p /app/uploads && chown -R billing:billing /app
USER billing

EXPOSE 4001

ENTRYPOINT ["dumb-init", "--"]
CMD ["docker-entrypoint.sh"]
