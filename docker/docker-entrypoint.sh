#!/bin/sh
set -e

# ── Wait for database ───────────────────────────────────
wait_for_db() {
  local host="${DB_HOST:-localhost}"
  local port="${DB_PORT:-3306}"
  local max_retries="${DB_WAIT_RETRIES:-30}"
  local retry_interval="${DB_WAIT_INTERVAL:-2}"
  local attempt=1

  echo "Waiting for database at ${host}:${port}..."

  while [ "$attempt" -le "$max_retries" ]; do
    if nc -z "$host" "$port" 2>/dev/null; then
      echo "Database is ready (attempt ${attempt}/${max_retries})"
      return 0
    fi
    echo "Database not ready (attempt ${attempt}/${max_retries}), retrying in ${retry_interval}s..."
    sleep "$retry_interval"
    attempt=$((attempt + 1))
  done

  echo "ERROR: Database at ${host}:${port} not reachable after ${max_retries} attempts"
  exit 1
}

# ── Wait for Redis ───────────────────────────────────────
wait_for_redis() {
  local host="${REDIS_HOST:-localhost}"
  local port="${REDIS_PORT:-6379}"
  local max_retries="${REDIS_WAIT_RETRIES:-15}"
  local retry_interval="${REDIS_WAIT_INTERVAL:-2}"
  local attempt=1

  echo "Waiting for Redis at ${host}:${port}..."

  while [ "$attempt" -le "$max_retries" ]; do
    if nc -z "$host" "$port" 2>/dev/null; then
      echo "Redis is ready (attempt ${attempt}/${max_retries})"
      return 0
    fi
    echo "Redis not ready (attempt ${attempt}/${max_retries}), retrying in ${retry_interval}s..."
    sleep "$retry_interval"
    attempt=$((attempt + 1))
  done

  echo "ERROR: Redis at ${host}:${port} not reachable after ${max_retries} attempts"
  exit 1
}

# ── Main ─────────────────────────────────────────────────
wait_for_db
wait_for_redis

# Run migrations if enabled
if [ "${DB_AUTO_MIGRATE}" = "true" ]; then
  echo "Running database migrations..."
  node packages/server/dist/server/src/db/migrate.js
  echo "Migrations complete."
fi

# Run seeds if enabled — only if no users exist (first-time setup)
if [ "${DB_AUTO_SEED}" = "true" ]; then
  echo "Running seeds (idempotent — skips if data exists)..."
  node packages/server/dist/server/src/db/seed.js || echo "Seeding skipped or failed (non-fatal)."
fi

echo "Starting emp-billing server..."
exec node packages/server/dist/server/src/index.js
