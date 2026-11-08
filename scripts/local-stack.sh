# Sourced by test-integration.sh and test-e2e.sh, from the repository root:
# starts the local Supabase CLI stack (Docker), refuses to go on unless its
# database is local, defines `run` and applies the Drizzle migrations. Never
# touches a cloud project: what `run` starts gets only the variables set here,
# not api/.env or your shell's.
#
# The local stack is shared by every worktree on this machine, and the tests
# empty its tables.

if ! docker info > /dev/null 2>&1; then
  echo "Docker is not running. Start Docker Desktop and try again." >&2
  exit 1
fi

# Only what the API uses: Postgres, Auth and Kong in front of it (real-time
# updates go over our own SSE streams, not Supabase Realtime). The CLI signs
# user tokens with an ES256 key of its own, which api/middlewares/jwt.ts
# requires.
supabase start \
  -x studio,edge-runtime,logflare,vector,imgproxy,storage-api,supavisor,postgres-meta,mailpit,realtime

# API_URL, ANON_KEY, SERVICE_ROLE_KEY, DB_URL, ...
eval "$(supabase status -o env)"

case "$DB_URL" in
  *@127.0.0.1:* | *@localhost:*) ;;
  *)
    echo "Refusing to run: the local stack's DB_URL is not local." >&2
    exit 1
    ;;
esac

# Runs a command in a clean environment, so nothing from api/.env or the
# shell (a cloud DATABASE_URL, an OpenRouter key, a PostHog token) reaches
# it. Extra variables go first: `run PORT=8123 node main.ts`.
run() {
  env -i \
    PATH="$PATH" \
    HOME="$HOME" \
    DATABASE_URL="$DB_URL" \
    SUPABASE_URL="$API_URL" \
    SUPABASE_ANON_KEY="$ANON_KEY" \
    SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
    DEVCON_VERIFICATION_SECRET=local-test-secret \
    "$@"
}

echo "Applying migrations..."
(cd api && run node migrate.ts)
