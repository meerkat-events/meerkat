# syntax=docker/dockerfile:1
FROM node:26-bookworm-slim

# Node 26 no longer ships corepack. Take the pnpm binary from its official
# image, which is what https://pnpm.io/docker recommends; the standalone install
# script is the other supported route but needs curl or wget, and this base image
# has neither. Keep the tag in sync with "packageManager" in the root package.json.
COPY --from=ghcr.io/pnpm/pnpm:12.4.1 /opt/pnpm /opt/pnpm
ENV PATH="/opt/pnpm:$PATH"

WORKDIR /workspace

# Copy workspace manifests first for dependency layer caching
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/react/package.json ./packages/react/
COPY api/package.json ./api/

RUN pnpm install --frozen-lockfile

COPY packages/react/ ./packages/react/
COPY api/ ./api/

ENV NODE_ENV=production

# Compiled into the browser bundle by the build below and nowhere else: as
# ARGs (not ENV) they stay out of the running container's environment, and
# declared here they leave the dependency layers cached when they change.
# API origin (app/lib/api-url.ts); empty means the page's own origin.
ARG VITE_API_URL
# Operator JSON for the legal page (`legalOperator` in api/vite.config.ts).
ARG LEGAL_OPERATOR

RUN pnpm -r build

# Upload the browser bundle's source maps to PostHog error tracking and delete
# them (api/scripts/upload-sourcemaps.sh). The API key is a build secret
# (`fly deploy --build-secret POSTHOG_CLI_API_KEY=...`), so it never ends up
# in a layer; without it the maps are only deleted.
#
# posthog-cli verifies TLS against the system's CA certificates, which the
# slim image doesn't ship.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ARG POSTHOG_CLI_HOST
ARG POSTHOG_CLI_PROJECT_ID
ARG RELEASE_VERSION
RUN --mount=type=secret,id=POSTHOG_CLI_API_KEY,env=POSTHOG_CLI_API_KEY \
  ./api/scripts/upload-sourcemaps.sh

WORKDIR /workspace/api

CMD ["node", "--import", "./instrumentation.ts", "./main.ts"]
