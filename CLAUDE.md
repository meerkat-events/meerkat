# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

Meerkat is a privacy-preserving audience engagement (Q&A) tool for conferences.
It uses Zupass + PCD (Proof-Carrying Data) for privacy-preserving authentication
via zero-knowledge proofs.

## Repository Structure

This is a monorepo managed with pnpm workspaces (installed via corepack):

- **`api/`** — Main application: Node.js + React Router 7 (full-stack, SSR). The
  HTTP API (Hono), React frontend, and DB schema/migrations (Drizzle ORM) all
  live here.
- **`packages/react/`** — Published npm package `@meerkat-events/react` with
  React hooks (`useQuestions`, `useEventSource`) for external consumers
  embedding Meerkat Q&A.
- **`scripts/setup.sh`** — Top-level dev bootstrap (env, deps, migrations, seed).
- **`api/scripts/seed.sh`** — DB seed script (invoked by `setup.sh`).

## Initial Setup

```bash
./scripts/setup.sh   # copies .env, installs deps, runs migrations, seeds DB
```

## Working in a new git worktree

Each git worktree has its own `node_modules`. After creating a worktree, run
`pnpm install` from the worktree root before doing anything else — the shared
pre-commit hook (lint-on-commit) needs `api/node_modules/.bin/eslint` to be
present and will skip linting with a warning otherwise.

## Development

```bash
cd api && pnpm dev
```

## Key Commands

### API (`api/`)

```bash
pnpm dev             # dev server with node --watch (reloads on changes)
pnpm build           # production build — REQUIRED after any frontend (React) changes
pnpm start           # run production build
pnpm typecheck       # runs build then type-checks all files
pnpm lint            # ESLint
pnpm generate        # generate Drizzle migration from schema changes
pnpm migrate         # apply pending migrations
```

### React Package (`packages/react/`)

```bash
pnpm build           # tsup build (ESM + CJS)
pnpm dev             # tsup watch
```

## Architecture

### API Structure

The API (`api/`) uses React Router 7 for the frontend (with SSR) and Hono for
the HTTP API layer:

- `api/routes/` — Hono HTTP endpoints: `conferences.ts`, `users.ts`,
  `events.ts`, `questions.ts`, `admin.ts`, `auth.ts`
- `api/middlewares/` — `jwt.ts` (Supabase JWT validation) and `api-key.ts`
  (admin)
- `api/models/` — Data access layer (Drizzle queries)
- `api/lib/pod.ts` — CommonJS shim around `@pcd/pod` (its ESM build pulls in
  CJS-only deps); the actual POD construction lives in `api/zupass.ts`
- `api/utils/broadcast.ts` — Supabase Realtime fan-out for SSE
- `api/app/routes/` — React Router page components
- `api/app/hooks/` — Custom data-fetching hooks (pattern: `use-[resource].ts`)
- `api/app/components/` — Shared UI components (Chakra UI v3)
- `api/schema.ts` — Single source of truth for the DB schema (Drizzle ORM)
- `api/drizzle/` — Migration SQL files and snapshots

Detailed API guidance lives in [api/CLAUDE.md](api/CLAUDE.md).

### Real-time updates

Two parallel mechanisms, both fanned out across instances via Supabase
Realtime:

- **SSE (`/api/v1/events/:uid/questions/stream`)** — the public-facing channel
  consumed by `@meerkat-events/react`'s `useEventSource` / `useQuestions`. The
  Hono handler subscribes to a per-event Supabase channel via
  `utils/broadcast.ts`; mutations call `broadcastQuestionsUpdate(eventId)` so
  every server instance pushes an SSE message to its connected clients.
- **Supabase Realtime directly from the browser** — internal hooks
  (`useAllQuestions`, `useLiveEventSubscription`, `use-reactions-subscription`)
  subscribe to `postgres_changes` or broadcast channels via the supabase-js
  client, then revalidate SWR caches.

Frontend data fetching uses SWR throughout (`hooks/fetcher.ts`).

### Authentication

- **User auth:** `api/middlewares/jwt.ts` uses Hono's `jwk()` against Supabase's
  JWKS endpoint (`${supabaseUrl}/auth/v1/.well-known/jwks.json`). Tokens are
  Supabase-issued via OTP email or anonymous sign-in. A separate Devcon SSO
  flow in `routes/auth.ts` validates HS256 JWTs against `DEVCON_JWT_SECRET`
  and exchanges them for a Supabase session.
- **Admin auth:** `api/middlewares/api-key.ts` — argon2-hashed keys stored in
  the DB, passed via `x-api-key`.
- The `PRIVATE_KEY` env var is only for signing Zupass attendance PODs, not
  for JWT auth.

### Data Flow

1. Browser → Hono API routes → models (Drizzle) → PostgreSQL (Supabase)
2. Auth: Supabase JWT (or Devcon SSO → Supabase session) → `middlewares/jwt.ts`
3. Mutations broadcast via Supabase Realtime → SSE stream to embedded clients
   and direct realtime subscriptions to the in-app frontend → SWR
   auto-revalidates

### Database Changes

1. Edit `api/schema.ts`
2. `cd api && pnpm generate` — creates migration file in `api/drizzle/`
3. `cd api && pnpm migrate` — applies it

## Validation Checklist

Before considering any change complete, always run all four checks from the
`api/` directory (or the repo root for Docker):

```bash
# 1. Type-check (also runs the build internally)
cd api && pnpm typecheck

# 2. Lint
cd api && pnpm lint

# 3. Build & run the Docker image
docker build -t meerkat:latest .
docker run --rm --env-file api/.env -p 8000:8000 meerkat:latest &
sleep 4 && curl -s http://localhost:8000 -o /dev/null -w "HTTP %{http_code}\n"
docker stop $(docker ps -q --filter ancestor=meerkat:latest)
```

All four must pass (typecheck clean, lint clean, Docker build succeeds,
HTTP 200) before the task is done.

## Code Style

- **Browser globals**: use `globalThis` instead of `window` (e.g.,
  `globalThis.open(url, '_blank')` for new tabs)
- **Ternary formatting**: condition on same line, branches on new lines with
  indentation:
  ```typescript
  isLoading
    ? <Loading />
    : data && data.length > 0
    ? <DataView />
    : <EmptyState />;
  ```
- **Data hooks**: named `use-[resource-name].ts`, return
  `{ data, isLoading, error }`, use SWR + `hooks/fetcher.ts`
- **Routing helpers**: use `qa(uid)` and `card(uid)` from `routing.ts` — don't
  construct URLs manually

## Git Workflow

- **Stashes**: multiple agents run in parallel against this repo, so
  `git stash` / `git stash pop` is unsafe — the index is shared and another
  agent may pop your stash (or you may pop theirs). Always use named stashes
  via `git stash push -m "<descriptive-name>"` and pop them by reference with
  `git stash pop stash^{/<descriptive-name>}` (or look up the exact stash
  index with `git stash list` and pop that index explicitly).

## Environment Variables

Required (in `api/.env`):

| Variable                    | Purpose                                              |
| --------------------------- | ---------------------------------------------------- |
| `DATABASE_URL`              | PostgreSQL connection string                         |
| `PRIVATE_KEY`               | Signs PODs (generate: `openssl rand -hex 32`)        |
| `BASE_URL`                  | App base URL                                         |
| `ZUPASS_URL`                | Zupass server URL                                    |
| `ZUPASS_ZAPP_NAME`          | Zupass zapp name                                     |
| `SUPABASE_URL`              | Supabase project URL                                 |
| `SUPABASE_ANON_KEY`         | Supabase anon key                                    |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (admin API)                |
| `DEVCON_JWT_SECRET`         | Shared HS256 secret for validating Devcon SSO tokens |

Optional: `SENTRY_DSN`, `DATABASE_POOLER_URL`, `DATABASE_MAX_POOL_SIZE`,
`ENVIRONMENT`
