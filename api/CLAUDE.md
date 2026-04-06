# API — CLAUDE.md

Detailed guidance for working in the `api/` directory.

## Runtime

Node.js 24 + **tsx** (TypeScript execution without a compile step at runtime).
ESM throughout (`"type": "module"` in `package.json`).

TypeScript is checked via `tsconfig.json` with
`allowImportingTsExtensions: true` so `.ts` extension imports are valid — tsx
handles them at runtime, Vite handles them during the frontend build.

## Architecture

A single Node.js process runs two concerns with **Hono** as the HTTP layer:

1. **API routes** (`routes/*.ts`) — JSON endpoints under `/api/v1/*`
2. **React Router 7 SSR** — serves the built React frontend (static assets from
   `build/client/`, SSR handler from `build/server/index.js`)

Entrypoint: `main.ts` — used for both production (`npm run start`) and
development (`npm run dev`, which adds `--watch` and `--env-file` flags via the
npm script).

Both are identical: they register the Hono API routes via `app.ts`, then serve
static assets and fall through to the React Router SSR handler.

### Request flow

```
Browser request
  → Hono middleware (pino logger)
  → API route match? → routes/*.ts → models/*.ts → Drizzle ORM → PostgreSQL
  → No match → serveStatic (build/client/) via @hono/node-server/serve-static
  → No static file → React Router SSR handler (build/server/index.js)
```

### React Router as backend-for-frontend

React Router 7 is used in SSR mode (`ssr: true` in `react-router.config.ts`).
The frontend is **built** with `npm run build` (Vite + `@react-router/dev`), and
the resulting server bundle is imported at runtime by the Hono entrypoint. The
Hono API and React Router SSR share the same port — Hono handles `/api/*` first,
and React Router handles everything else.

### Real-time updates

SSE endpoint: `GET /api/v1/events/:uid/questions/stream` (in
`routes/events.ts`).

Uses Supabase Realtime broadcast for cross-instance fan-out
(`utils/broadcast.ts`):

- Each server instance subscribes to a per-event Supabase channel.
- `broadcastQuestionsUpdate()` posts to Supabase REST broadcast API so all
  instances receive the signal, not just the one that made the DB change.
- Frontend hooks (`useQuestions`) auto-revalidate via SWR when the SSE fires.

## Key files

| File                 | Purpose                                                           |
| -------------------- | ----------------------------------------------------------------- |
| `app.ts`             | Hono app with all API route mounts and global error handler       |
| `main.ts`            | Server entrypoint (Node.js `serve` + static + React Router SSR)   |
| `env.ts`             | All `process.env` vars — validated and exported as a typed object |
| `schema.ts`          | Drizzle ORM schema — **single source of truth** for DB structure  |
| `db.ts`              | Drizzle client (postgres.js driver, connection pooling via env)   |
| `instrumentation.ts` | Sentry init — imported first in entrypoints                       |
| `supabase.ts`        | Supabase client (for Realtime broadcast subscriptions)            |
| `zupass.ts`          | Creates signed POD attendance proofs                              |
| `utils/broadcast.ts` | Supabase Realtime channel manager for SSE fan-out                 |
| `utils/secret.ts`    | HMAC-SHA256 signing with Node.js `crypto.subtle`                  |

## Frontend (`app/`)

React Router 7 with SSR. Chakra UI for components. SWR for data fetching.

- Path alias `~/` maps to `app/` (resolved via `tsconfig.json` paths + Vite
  alias)
- Route config: `app/routes.ts`
- Data hooks: `app/hooks/use-[resource].ts` — return
  `{ data, isLoading, error }` using SWR + `hooks/fetcher.ts`
- Routing helpers: `app/routing.ts` exports `qa(uid)` and `card(uid)` — always
  use these, never construct URLs manually

Build: `npm run build` — REQUIRED after any changes to `app/` files.

## Auth

- **User auth**: Supabase-issued JWTs validated via JWKS (`middlewares/jwt.ts`).
  Uses Hono's `jwk()` middleware against
  `${supabaseUrl}/auth/v1/.well-known/jwks.json`. Supports OTP email and
  anonymous sign-in.
- **Admin auth**: argon2-hashed API keys in DB (`middlewares/api-key.ts`). Pass
  via `x-api-key` header.
- **Zupass/PCD**: ticket proof verification delegated to the separate `verifier`
  service (`VERIFIER_ENDPOINT` env var).

## Import conventions

- `.ts` extensions in all local imports (e.g. `from "./env.ts"`) — required for
  tsx runtime compatibility and consistent with the codebase
- `~/` alias for `app/` directory
- All packages imported by npm name (e.g. `hono`, `hono/streaming`)
- No `npm:` or `jsr:` prefixes — this is Node.js, not Deno

## Database changes

1. Edit `api/schema.ts`
2. `cd db && npm run generate` — creates a Drizzle migration file
3. `cd db && npm run migrate` — applies the migration

## npm scripts

```bash
npm run dev          # tsx --watch ./dev.ts (requires .env)
npm run build        # react-router build (production frontend bundle)
npm run start        # tsx ./main.ts (requires built frontend in build/)
npm run typecheck    # react-router typegen && tsc --noEmit
npm run typegen      # regenerate .react-router/types
```
