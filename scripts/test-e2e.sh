#!/bin/bash
# End-to-end tests of the core user stories (e2e/): Playwright drives the
# built app in Chromium against the local Supabase CLI stack (Docker). Starts
# the stack and migrates (local-stack.sh), builds the app, then runs
# `playwright test` with any arguments given, e.g. a spec file or
# `--repeat-each=5`. The app gets only the stack's environment, not
# api/.env. The local stack is shared by every worktree on this machine, and
# the tests empty its tables.
#
# E2E_SKIP_BUILD=1 reuses the existing build (CI's typecheck step built it).
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo"

# Starts the stack, defines `run` and migrates.
source scripts/local-stack.sh

if [ -z "${E2E_SKIP_BUILD:-}" ]; then
  echo "Building the app..."
  pnpm --dir packages/react build > /dev/null
  # An empty VITE_API_URL in the environment wins over api/.env's: the
  # frontend then calls the origin that served it, whatever the port.
  (cd api && run VITE_API_URL= pnpm build > /dev/null)
fi

# A build with api/.env's VITE_API_URL compiled in would call that origin,
# not the test server. CI has no api/.env.
env_api_url=""
if [ -f api/.env ]; then
  env_api_url="$(sed -n 's/^VITE_API_URL=//p' api/.env | tr -d "\"'")"
fi
if [ -n "$env_api_url" ] && grep -rqF "$env_api_url" api/build/client/assets; then
  echo "The build calls $env_api_url (VITE_API_URL): rebuild without it." >&2
  exit 1
fi

# One free port, chosen here: Playwright reads its config in every worker.
port="$(node -e '
  const server = require("node:net").createServer();
  server.listen(0, "127.0.0.1", () => {
    console.log(server.address().port);
    server.close();
  });
')"

echo "Running end-to-end tests on port $port..."
cd e2e
run PORT="$port" E2E_PORT="$port" CI="${CI:-}" \
  pnpm exec playwright test "$@"
