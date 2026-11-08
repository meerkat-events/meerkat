#!/bin/bash
# Integration tests against the local Supabase CLI stack (Docker): starts the
# stack and applies the Drizzle migrations (local-stack.sh), then runs
# api/integration/*.int.ts with node:test, or the files given as arguments.
# The local stack is shared by every worktree on this machine, and the tests
# empty its tables.
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo"

# Starts the stack, defines `run` and migrates.
source scripts/local-stack.sh

echo "Running integration tests..."
# The app keeps its database pool and realtime listener open, so the test
# processes would never exit on their own. One file at a time: every file
# empties the same database.
cd api
# Files to run: the arguments, or every integration test.
if [ $# -gt 0 ]; then
  files=("$@")
else
  files=(integration/*.int.ts)
fi
# COVERAGE_REPORT=<file> also writes a report with line coverage there (CI).
coverage=()
if [ -n "${COVERAGE_REPORT:-}" ]; then
  coverage=(
    --experimental-test-coverage
    --test-coverage-exclude='**/*.test.ts'
    --test-coverage-exclude='**/*.int.ts'
    --test-coverage-exclude='integration/**'
    --test-coverage-exclude='testing/**'
    --test-reporter=spec --test-reporter-destination=stdout
    --test-reporter=spec --test-reporter-destination="$COVERAGE_REPORT"
  )
fi
run node --test --test-force-exit --test-concurrency=1 ${coverage[@]+"${coverage[@]}"} "${files[@]}"
