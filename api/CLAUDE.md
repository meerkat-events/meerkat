# API — CLAUDE.md

Detailed guidance for working in the `api/` directory.

## Runtime

Node.js 26 — runs `.ts` files directly via the native type-stripping loader.
No `tsx`, no `ts-node`, no compile step at runtime. ESM throughout
(`"type": "module"` in `package.json`).

`tsconfig.json` sets `allowImportingTsExtensions: true` so `.ts` extension
imports are valid — Node 26 resolves them natively, and Vite handles them
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

Route `loader`s run inside that server bundle. Server-only code for them lives
in `.server.ts` modules (excluded from the client build; the build fails if
one is imported from client code). Anything such a module imports from
outside `app/` (`env.ts`, `logger.ts`, `usernames.ts`, …) is bundled as a
**copy**, separate from the instance Hono uses — so keep loaders away from
`db.ts` (a bundled copy would open a second connection pool) and keep those
modules free of import-time side effects (`env.ts` validates only; `main.ts`
logs the parsed env once).

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
| `migrate.ts`         | Applies Drizzle migrations; Fly `release_command` on every deploy |
| `instrumentation.ts` | Sentry init — imported first in `main.ts`                         |
| `supabase.ts`        | Supabase client (Realtime broadcast + admin operations)           |
| `zupass.ts`          | Builds and signs Zupass attendance PODs                           |
| `devcon.ts`          | Verifies Devcon handover tokens (HS256, ms timestamps)            |
| `pretalx.ts`         | Syncs a Pretalx event's schedule into a conference's events       |
| `app/lib/handover.server.ts` | Devcon handover: token → Supabase session (server-only)   |
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

Exactly three sign-in methods exist. Each produces a Supabase session whose
JWT `middlewares/jwt.ts` validates via JWKS (Hono's `jwk()` against
`${supabaseUrl}/auth/v1/.well-known/jwks.json`):

1. **Anonymous** — `hooks/use-anonymous-user.ts` (`signInAnonymously()`).
2. **Email OTP** — `hooks/use-otp.ts` (`signInWithOtp()` + `verifyOtp()`).
3. **Devcon handover** — Devcon redirects to `/e/:uid/qa?token=<jwt>`. The
   server `loader` in `app/routes/QnA.tsx` (the app's only server loader)
   calls `consumeHandoverToken()` from `app/lib/handover.server.ts`, which
   verifies the token with `devcon.ts` (`hono/jwt` `verify` against
   `DEVCON_VERIFICATION_SECRET` with `exp`/`iat`/`nbf` checks disabled —
   Devcon's claims are **milliseconds** — and a millisecond expiry check of
   its own), then mints a Supabase session with
   `admin.generateLink()` + `verifyOtp()` (using the reported
   `verification_type`, which is `signup` for first-time users). The loader
   redirects to the clean Q&A URL with the session encoded in the URL
   fragment, exactly like Supabase's own magic-link redirect; the browser's
   Supabase client (`detectSessionInUrl`) adopts it on load. Failures
   redirect with `?handover=expired|invalid|failed`, rendered as an alert by
   the page. The `clientLoader` forces a document load for token URLs so this
   also holds for in-app navigations. There is no API endpoint for the
   handover.

The admin API is separate: argon2-hashed API keys in the DB
(`middlewares/api-key.ts`), passed via the `x-api-key` header.

## Import conventions

- `.ts` extensions in all local imports (e.g. `from "./env.ts"`) — required by
  Node 26's native loader and consistent with the codebase
- `~/` alias for `app/` directory
- All packages imported by npm name (e.g. `hono`, `hono/streaming`)
- No `npm:` or `jsr:` prefixes — this is Node.js, not Deno

## Database changes

1. Edit `api/schema.ts`
2. `cd api && pnpm generate` — creates a Drizzle migration file in
   `api/drizzle/`
3. `cd api && pnpm migrate` — applies pending migrations locally; deploys run
   `migrate.ts` as Fly's `release_command` instead

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
