# API — CLAUDE.md

Detailed guidance for working in the `api/` directory.

## Runtime

Node.js 24 — runs `.ts` files directly via the native type-stripping loader.
No `tsx`, no `ts-node`, no compile step at runtime. ESM throughout
(`"type": "module"` in `package.json`).

`tsconfig.json` sets `allowImportingTsExtensions: true` so `.ts` extension
imports are valid — Node 24 resolves them natively, and Vite handles them
during the frontend build. The config also enforces `erasableSyntaxOnly` so
only TypeScript syntax that Node can strip without codegen is allowed (no
enums, no namespaces with runtime values, no parameter properties).

The dev script (`pnpm dev`) launches with `node --env-file=.env --watch
./main.ts` — Node loads the env file natively and restarts on file changes.
The server listens on `PORT` (default 8000); a `PORT` already in the process
environment wins over the one in `.env`, which is how the desktop app's
`autoPort` hands each worktree its own port.

## Architecture

A single Node.js process runs two concerns with **Hono** as the HTTP layer:

1. **API routes** (`routes/*.ts`) — JSON endpoints under `/api/v1/*`, mounted
   in `app.ts`
2. **React Router 7 SSR** — serves the built React frontend (static assets
   from `build/client/`, SSR handler from `build/server/index.js`)

Entrypoint: `main.ts` — used for both production (`pnpm start`) and
development (`pnpm dev`, which adds `--watch` and `--env-file=.env`). It
registers the Hono API routes via `app.ts`, then serves static assets and
falls through to the React Router SSR handler.

### Request flow

```
Browser request
  → Hono middleware (pino logger)
  → API route match? → routes/*.ts → models/*.ts → Drizzle ORM → PostgreSQL
  → No match → serveStatic (build/client/) via @hono/node-server/serve-static
  → No static file → React Router SSR handler (build/server/index.js)
```

### React Router as backend-for-frontend

React Router 7 in SSR mode (`ssr: true` in `react-router.config.ts`). The
frontend is **built** with `pnpm build` (Vite + `@react-router/dev`), and the
resulting server bundle is imported at runtime by `main.ts`. Hono and React
Router share the same port — Hono handles `/api/*` first, React Router
handles everything else.

`vite.config.ts` `ssr.noExternal` bundles `@pcd/*`, `@parcnet-js/*`,
`@zk-kit/*`, `blakejs`, and `@semaphore-protocol/*` into the server build to
work around CJS-only transitive deps that break native Node ESM resolution.

### Real-time updates

Two parallel mechanisms, both fanned out across instances via Supabase
Realtime:

- **SSE endpoint** (`GET /api/v1/events/:uid/questions/stream`, in
  `routes/events.ts`) — public-facing channel consumed by the
  `@meerkat-events/react` package. Each server instance subscribes to a
  per-event Supabase channel via `utils/broadcast.ts`; mutations call
  `broadcastQuestionsUpdate(eventId)`, which posts to Supabase's REST
  broadcast API so every instance pushes an SSE message to its connected
  clients.
- **Direct Supabase Realtime** — internal frontend hooks
  (`useAllQuestions`, `useLiveEventSubscription`,
  `use-reactions-subscription`) subscribe to `postgres_changes` or broadcast
  channels via the supabase-js client and revalidate SWR caches on update.

## Key files

| File                 | Purpose                                                           |
| -------------------- | ----------------------------------------------------------------- |
| `app.ts`             | Hono app with all API route mounts and global error handler       |
| `main.ts`            | Server entrypoint (`@hono/node-server` + static + RR SSR)         |
| `env.ts`             | All `process.env` vars — validated and exported as a typed object |
| `schema.ts`          | Drizzle ORM schema — **single source of truth** for DB structure  |
| `db.ts`              | Drizzle client (postgres.js driver, pool size from env)           |
| `instrumentation.ts` | Sentry init — imported first in `main.ts`                         |
| `supabase.ts`        | Supabase client (Realtime broadcast + admin operations)           |
| `zupass.ts`          | Builds and signs Zupass attendance PODs                           |
| `lib/pod.ts`         | CJS shim around `@pcd/pod` (its ESM build pulls in CJS-only deps) |
| `utils/broadcast.ts` | Supabase Realtime channel manager for SSE fan-out                 |
| `moderation.ts`      | Server-side moderation rules                                      |
| `usernames.ts`       | Anonymous username generation                                     |

## Frontend (`app/`)

React Router 7 with SSR. Chakra UI v3 for components. SWR for data fetching.

- Path alias `~/` maps to `app/` (resolved via `tsconfig.json` paths + Vite
  alias)
- Route config: `app/routes.ts`
- Data hooks: `app/hooks/use-[resource].ts` — return
  `{ data, isLoading, error }` using SWR + `hooks/fetcher.ts`
- API origin: `app/lib/api-url.ts` — `apiUrl(endpoint)` for fetches and
  `appOrigin()` for absolute links. With `VITE_API_URL` empty (the default)
  both resolve to the page's own origin, so a build works on any port. Never
  read `import.meta.env.VITE_API_URL` elsewhere.
- Routing helpers: `app/routing.ts` exports `qa(uid)` and `card(uid)` — always
  use these, never construct URLs manually

Build: `pnpm build` — REQUIRED after any changes to `app/` files (the SSR
server build is imported at runtime by `main.ts`).

## Auth

- **User auth**: Supabase-issued JWTs validated via JWKS (`middlewares/jwt.ts`).
  Uses Hono's `jwk()` middleware against
  `${supabaseUrl}/auth/v1/.well-known/jwks.json`. Supports OTP email,
  anonymous sign-in, and Devcon SSO (HS256 against `DEVCON_JWT_SECRET`,
  exchanged for a Supabase session in `routes/auth.ts`).
- **Admin auth**: argon2-hashed API keys in DB (`middlewares/api-key.ts`). Pass
  via `x-api-key` header.

## Import conventions

- `.ts` extensions in all local imports (e.g. `from "./env.ts"`) — required by
  Node 24's native loader and consistent with the codebase
- `~/` alias for `app/` directory
- All packages imported by npm name (e.g. `hono`, `hono/streaming`)
- No `npm:` or `jsr:` prefixes — this is Node.js, not Deno

## Database changes

1. Edit `api/schema.ts`
2. `cd api && pnpm generate` — creates a Drizzle migration file in
   `api/drizzle/`
3. `cd api && pnpm migrate` — applies pending migrations

## pnpm scripts

```bash
pnpm dev          # node --env-file=.env --watch ./main.ts (requires .env)
pnpm build        # NODE_ENV=production react-router build
pnpm start        # node ./main.ts (requires built frontend in build/)
pnpm typecheck    # react-router typegen && react-router build && tsc --noEmit
pnpm typegen      # regenerate .react-router/types
pnpm lint         # ESLint
pnpm generate     # drizzle-kit generate
pnpm migrate      # drizzle-kit migrate
```
