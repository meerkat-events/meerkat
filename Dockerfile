FROM node:26-bookworm-slim

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Node 26 no longer ships corepack, so install the pinned pnpm with npm.
# --allow-scripts lets pnpm unpack its native binary; npm 11 blocks it otherwise.
# Keep this version in sync with "packageManager" in the root package.json.
RUN npm install -g --allow-scripts=pnpm pnpm@12.4.1 && npm cache clean --force

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
