# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

Meerkat is a privacy-preserving audience engagement (Q&A) tool for conferences.
It uses Zupass + PCD (Proof-Carrying Data) for privacy-preserving authentication
via zero-knowledge proofs.

## Repository Structure

This is a multi-service monorepo:

- **`api/`** — Main application: Deno + React Router 7 (full-stack, SSR). Both
  the HTTP API (Hono) and the React frontend live here.
- **`db/`** — Database schema (Drizzle ORM) and migrations against PostgreSQL
  (Supabase).
- **`verifier/`** — Separate Node.js/Hono service for cryptographic PCD ticket
  verification.
- **`packages/react/`** — Published npm package `@meerkat-events/react` with
  React hooks for external consumers.
- **`scripts/`** — Dev setup/teardown scripts (tmux-based).

## Initial Setup

```bash
./scripts/setup.sh   # copies .env, installs deps, runs migrations, seeds DB
./scripts/teardown.sh  # tear down dev environment
```

## Development

```bash
./scripts/dev.sh     # starts tmux session: API (pane 1) + Verifier (pane 2), opens https://localhost:8000
```

Or run services individually:

```bash
# API (Deno)
cd api && deno task dev

# Verifier (Node.js)
cd verifier && npm run dev
```

## Key Commands

### API (`api/`)

```bash
deno task dev        # dev server with watch + inspect
deno task build      # production build (required after changes — no live reload)
deno task start      # run production build
deno lint            # lint
deno fmt             # format
```

### Database (`db/`)

```bash
npm run generate     # generate Drizzle migration from schema changes
npm run migrate      # apply pending migrations
```

### React Package (`packages/react/`)

```bash
npm run build        # tsup build (ESM + CJS)
npm run dev          # tsup watch
```

### Verifier (`verifier/`)

```bash
npm run dev          # tsx watch
npm run build        # tsc compile to dist/
```

## Architecture

### API Structure

The API (`api/`) uses React Router 7 for the frontend (with SSR) and Hono for
the HTTP API layer:

- `api/routes/` — Hono HTTP endpoints: `conferences.ts`, `users.ts`,
  `events.ts`, `questions.ts`, `admin.ts`
- `api/models/` — Data access layer (Drizzle queries)
- `api/app/routes/` — React Router page components
- `api/app/hooks/` — Custom data-fetching hooks (pattern: `use-[resource].ts`)
- `api/app/components/` — Shared UI components (Chakra UI)
- `api/schema.ts` — Single source of truth for the DB schema (Drizzle ORM)

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
3. For ticket proof verification → call the separate `verifier` service
4. Real-time updates → SSE stream from API → `useQuestions` hook
   auto-revalidates

### Database Changes

1. Edit `api/schema.ts`
2. `cd db && npm run generate` — creates migration file
3. `cd db && npm run migrate` — applies it

## Code Style

- **Deno compatibility**: use `globalThis` instead of `window` (e.g.,
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
| `VERIFIER_ENDPOINT`         | Verifier service URL                                 |
| `DEVCON_JWT_SECRET`         | Shared HS256 secret for validating Devcon SSO tokens |

Optional: `POSTHOG_TOKEN`, `SENTRY_DSN`
