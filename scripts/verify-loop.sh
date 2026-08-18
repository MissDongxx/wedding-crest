#!/usr/bin/env bash
set -euo pipefail

export DATABASE_PROVIDER="${DATABASE_PROVIDER:-sqlite}"
export DATABASE_URL="${DATABASE_URL:-file:./data/local.db}"
export DB_SCHEMA_FILE="${DB_SCHEMA_FILE:-./src/config/db/schema.sqlite.ts}"
export DB_MIGRATIONS_OUT="${DB_MIGRATIONS_OUT:-./src/config/db/migrations_sqlite}"

echo '[verify-loop] lint'
pnpm lint
echo '[verify-loop] format'
pnpm format:check
echo '[verify-loop] build'
pnpm build
echo '[verify-loop] database push'
pnpm db:push
echo '[verify-loop] database generate'
pnpm db:generate
echo '[verify-loop] wedding domain checks'
pnpm test:wedding
echo '[verify-loop] 0'
