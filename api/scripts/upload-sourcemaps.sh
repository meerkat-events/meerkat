#!/bin/sh
# Uploads the browser bundle's source maps to PostHog error tracking, so
# exceptions from the minified bundle show the original source, then deletes
# them from build/client so they are never served. Runs after `pnpm build`
# in the Docker image (see Dockerfile).
#
# Needs POSTHOG_CLI_API_KEY (a personal API key with the "error tracking
# write" and "organization read" scopes), POSTHOG_CLI_PROJECT_ID and
# POSTHOG_CLI_HOST (the app host, e.g. https://eu.posthog.com). Without the
# key the maps are only deleted.
set -eu

cd "$(dirname "$0")/.."

if [ -n "${POSTHOG_CLI_API_KEY:-}" ]; then
  # Injects a chunk id (and the release) into each bundle, uploads the maps
  # and deletes them. A failed upload (PostHog down, a revoked key) costs
  # readable stack traces, not the deploy.
  if ! pnpm exec posthog-cli sourcemap process \
    --directory build/client \
    --release-name meerkat \
    --release-version "${RELEASE_VERSION:-unknown}" \
    --delete-after; then
    echo "Source map upload failed; exceptions will show minified stack traces"
  fi
else
  echo "POSTHOG_CLI_API_KEY not set, deleting source maps without uploading"
fi

find build/client -name '*.map' -delete
