#!/bin/bash
# Integration tests against the local Supabase CLI stack (Docker): starts the
# stack, applies the Drizzle migrations and supabase-policies.sql, then runs
# api/integration/*.int.ts with node:test. Never touches a cloud project: the
# tests get only the variables set here, not api/.env or your shell's.
#
# The local stack is shared by every worktree on this machine, and the tests
# empty its tables.
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo"

if ! docker info > /dev/null 2>&1; then
  echo "Docker is not running. Start Docker Desktop and try again." >&2
  exit 1
fi

# Only what the API uses: Postgres, Auth, Realtime (question
# broadcasts) and Kong in front of them. The CLI signs user tokens with an
# ES256 key of its own, which api/middlewares/jwt.ts requires.
supabase start \
  -x studio,edge-runtime,logflare,vector,imgproxy,storage-api,supavisor,postgres-meta,mailpit

# API_URL, ANON_KEY, SERVICE_ROLE_KEY, DB_URL, ...
eval "$(supabase status -o env)"

case "$DB_URL" in
  *@127.0.0.1:* | *@localhost:*) ;;
  *)
    echo "Refusing to run: the local stack's DB_URL is not local." >&2
    exit 1
    ;;
esac

# A clean environment, so nothing from api/.env or the shell (a cloud
# DATABASE_POOLER_URL, an OpenRouter key) reaches the tests.
run() {
  env -i \
    PATH="$PATH" \
    HOME="$HOME" \
    DATABASE_URL="$DB_URL" \
    DATABASE_POOLER_URL="$DB_URL" \
    SUPABASE_URL="$API_URL" \
    SUPABASE_ANON_KEY="$ANON_KEY" \
    SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
    DEVCON_VERIFICATION_SECRET=integration-test-secret \
    ENVIRONMENT=test \
    "$@"
}

echo "Applying migrations and policies..."
(cd api && run node migrate.ts)
psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f api/scripts/supabase-policies.sql

echo "Running integration tests..."
# The app keeps its database pool and Realtime client open, so the test
# processes would never exit on their own. One file at a time: every file
# empties the same database.
cd api
run node --test --test-force-exit --test-concurrency=1 integration/*.int.ts
