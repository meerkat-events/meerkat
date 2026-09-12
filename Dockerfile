FROM node:26-bookworm-slim

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

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

RUN pnpm -r build

WORKDIR /workspace/api

CMD ["node", "./main.ts"]
