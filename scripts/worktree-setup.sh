#!/bin/bash
# Bootstrap this checkout (the main one or a git worktree) so that `pnpm dev`,
# the desktop app's preview server and `pnpm typecheck` work:
#
#   1. api/.env         copied from the main checkout when missing
#   2. node_modules     pnpm install (hard links from the shared store; <1s when warm)
#   3. packages/react   built — the api's Vite build resolves @meerkat-events/react from dist/
#   4. api/build        built — api/main.ts imports build/server/index.js at startup
#
# Idempotent. With --if-needed only steps whose outputs are missing run (this is
# what the SessionStart hook in .claude/settings.json calls, so it costs a few
# milliseconds in a ready checkout). Without it every step runs; use that after
# pulling dependency or frontend changes.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

IF_NEEDED=0
case "${1:-}" in
  --if-needed) IF_NEEDED=1 ;;
  "") ;;
  *) echo "usage: $0 [--if-needed]" >&2; exit 64 ;;
esac

# Everything a subcommand prints goes to stderr; stdout carries one summary
# line at the end (a SessionStart hook's stdout becomes context for Claude).
exec 3>&1
exec 1>&2

log() { echo "[worktree-setup] $*"; }
needed() { [ "$IF_NEEDED" -eq 0 ] || [ ! -e "$1" ]; }

# Hooks run with Claude Code's environment, which may lack an nvm-managed PATH.
if ! command -v pnpm >/dev/null 2>&1 && [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "${NVM_DIR:-$HOME/.nvm}/nvm.sh" >/dev/null
fi
if ! command -v pnpm >/dev/null 2>&1; then
  log "pnpm not found on PATH; install Node 24+ and run 'corepack enable'"
  exit 1
fi

# 1. env file. .worktreeinclude makes Claude Code copy it into the worktrees it
#    creates; this covers `git worktree add` and worktrees from before that.
MAIN="$(cd "$(git rev-parse --git-common-dir)/.." && pwd)"
if [ ! -f api/.env ]; then
  if [ "$MAIN" != "$ROOT" ] && [ -f "$MAIN/api/.env" ]; then
    cp "$MAIN/api/.env" api/.env
    log "copied api/.env from $MAIN"
  else
    cp api/.env.example api/.env
    log "WARNING: created api/.env from .env.example; fill in the secrets before starting the server"
  fi
fi

# An absolute localhost VITE_API_URL pins the frontend to one port, which is
# wrong for a worktree that may get any port. A worktree's .env is always a
# copy, so blank it there; in the main checkout only warn (it is hand-edited).
NOTE=""
if grep -qE '^VITE_API_URL=["'"'"']?https?://(localhost|127\.0\.0\.1)' api/.env; then
  if [ "$MAIN" != "$ROOT" ]; then
    sed -i.bak -E 's|^VITE_API_URL=.*|VITE_API_URL=|' api/.env && rm -f api/.env.bak
    log "blanked VITE_API_URL in api/.env so the frontend uses the page's own origin"
  else
    NOTE="; NOTE: VITE_API_URL in api/.env points at localhost and pins the frontend to that port, set it empty"
    log "WARNING: VITE_API_URL in api/.env points at localhost; set it empty so the frontend follows PORT"
  fi
fi

# 2. dependencies
if needed api/node_modules/.bin/eslint || needed packages/react/node_modules; then
  log "pnpm install"
  pnpm install --frozen-lockfile
fi

# 3. react package
if needed packages/react/dist/index.js; then
  log "building packages/react"
  pnpm --filter @meerkat-events/react build
fi

# 4. api build
if needed api/build/server/index.js; then
  log "building api"
  pnpm --dir api build
fi

echo "[worktree-setup] ready: $ROOT (dev server: cd api && pnpm dev; port from PORT, default 8000)$NOTE" >&3
