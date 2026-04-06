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
  HTTP API (Hono), React frontend, DB schema/migrations (Drizzle ORM), and
  cryptographic PCD ticket verification all live here.
- **`packages/react/`** — Published npm package `@meerkat-events/react` with
  React hooks for external consumers.
- **`scripts/`** — Dev setup/teardown scripts.

## Initial Setup

```bash
./scripts/setup.sh   # copies .env, installs deps, runs migrations, seeds DB
./scripts/teardown.sh  # tear down dev environment
```

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
- `api/models/` — Data access layer (Drizzle queries)
- `api/lib/` — Shared utilities: `pod.ts` (Zupass POD signing), `verify.ts` (GPC
  ticket proof verification via `@pcd/gpc`)
- `api/app/routes/` — React Router page components
- `api/app/hooks/` — Custom data-fetching hooks (pattern: `use-[resource].ts`)
- `api/app/components/` — Shared UI components (Chakra UI)
- `api/schema.ts` — Single source of truth for the DB schema (Drizzle ORM)
- `api/drizzle/` — Migration SQL files and snapshots

Real-time Q&A updates use Server-Sent Events (SSE). The frontend hooks use SWR
for caching.

**Authentication:** `api/middlewares/jwt.ts` uses Hono's `jwk()` to validate
Bearer tokens against Supabase's JWKS endpoint
(`${supabaseUrl}/auth/v1/.well-known/jwks.json`). All user tokens are
Supabase-issued (via OTP email or anonymous sign-in). Admin routes use a
separate `api/middlewares/api-key.ts` with argon2-hashed keys stored in the DB.
The `PRIVATE_KEY` env var is only for Zupass POD signing, not JWT auth.

### Data Flow

1. Browser → Hono API routes → models (Drizzle) → PostgreSQL (Supabase)
2. Zupass authentication → JWT tokens → `api/middlewares/` auth middleware
3. For ticket proof verification → `api/lib/verify.ts` calls `@pcd/gpc` directly
4. Real-time updates → SSE stream from API → `useQuestions` hook
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

Optional: `POSTHOG_TOKEN`, `SENTRY_DSN`, `DATABASE_POOLER_URL`,
`DATABASE_MAX_POOL_SIZE`, `ENVIRONMENT`
