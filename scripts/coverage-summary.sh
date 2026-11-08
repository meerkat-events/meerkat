#!/bin/bash
# Appends the coverage table of a node:test spec report (written with
# --experimental-test-coverage) to the GitHub job summary, or prints it when
# there is no job summary (locally). Report only: coverage gates nothing.
#
#   scripts/coverage-summary.sh <report file> <title>
set -euo pipefail

report="$1"
title="$2"

if ! grep -q "start of coverage report" "$report"; then
  echo "No coverage report in $report" >&2
  exit 1
fi

# The table between the report's markers, without node's "ℹ " prefixes
table="$(sed -n '/start of coverage report/,/end of coverage report/p' "$report" \
  | sed -e 's/^ℹ //' -e '/coverage report$/d')"
# "all files | 56.80 | 90.48 | 33.89 |" → line coverage 56.80
lines="$(echo "$table" | awk -F'|' '/^all files/ { gsub(/ /, "", $2); print $2 }')"

summary="$(printf '### %s: %s%% of lines\n\n<details><summary>Per file</summary>\n\n```\n%s\n```\n\n</details>\n' \
  "$title" "$lines" "$table")"

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  echo "$summary" >> "$GITHUB_STEP_SUMMARY"
else
  echo "$summary"
fi
