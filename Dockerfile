FROM node:24-bookworm-slim

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

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
