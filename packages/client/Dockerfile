FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/client/package.json packages/client/
RUN corepack enable && pnpm install --frozen-lockfile
COPY packages/shared/ packages/shared/
COPY packages/client/ packages/client/
RUN pnpm --filter @emp-billing/client run build

FROM nginx:alpine
COPY --from=builder /app/packages/client/dist /usr/share/nginx/html
COPY packages/client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
