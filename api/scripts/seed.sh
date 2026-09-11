#!/bin/bash
set -e

# Resolve paths relative to this script so it works from any working directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(dirname "$SCRIPT_DIR")"

# Load DATABASE_URL from api/.env unless it is already set in the environment.
if [ -z "$DATABASE_URL" ] && [ -f "$API_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$API_DIR/.env"
  set +a
fi

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set and $API_DIR/.env was not found" >&2
  exit 1
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/seed.sql"
