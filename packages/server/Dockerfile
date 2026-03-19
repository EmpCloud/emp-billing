FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
RUN corepack enable && pnpm install --frozen-lockfile
COPY packages/shared/ packages/shared/
COPY packages/server/ packages/server/
RUN pnpm --filter @emp-billing/shared run build 2>/dev/null || true
RUN pnpm --filter @emp-billing/server run build 2>/dev/null || true

FROM node:20-alpine
RUN apk add --no-cache chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
WORKDIR /app
COPY --from=builder /app/packages/server/dist ./dist
COPY --from=builder /app/packages/server/package.json ./
COPY --from=builder /app/packages/server/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY packages/server/src/templates ./dist/templates
EXPOSE 4001
CMD ["node", "dist/index.js"]
