# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## What Meerkat is

Audience-engagement (Q&A) tool for conferences, used by the Ethereum
Foundation for Devcon/Devconnect. Attendees open `/e/:uid/qa` on their phones
to ask, upvote and react; organizers select/answer/delete questions and put an
event "live"; a presenter view at `/e/:uid` is shown on the stage screen. An
optional "collect" feature lets attendees store a signed attendance POD in
their Zupass.

## Repository layout

pnpm workspace (Node.js 24, pnpm via corepack). Two packages:

- **`api/`** (package name `ui`) — the whole application: Hono HTTP API,
  React Router 8 SSR frontend, Drizzle schema + migrations. Deeper notes in
  [api/CLAUDE.md](api/CLAUDE.md).
- **`packages/react/`** — `@meerkat-events/react`, a published npm package of
  hooks (`useQuestions`, `useEventSource`, `useSessionUrl`) for embedding
  Meerkat questions in third-party sites (see
  [designs/001-devcon-ui-integration.md](designs/001-devcon-ui-integration.md)).
  `api/` depends on it via `workspace:*` and resolves it from its `dist/`, so
  **it must be built before `api/` can build or typecheck.**

There is no test suite. Validation is typecheck + lint (+ Docker build).

## Commands

```bash
./scripts/setup.sh        # first time: copy .env, pnpm install, pnpm -r build, migrate, seed
pnpm install && pnpm -r build   # in every new git worktree (node_modules and dist are per-worktree)
```

### `api/`

```bash
pnpm dev        # node --env-file=.env --watch main.ts on port 8000 (port is hardcoded in main.ts)
pnpm build      # react-router build → build/client + build/server
pnpm typecheck  # react-router typegen && build && tsc --noEmit
pnpm lint       # eslint
pnpm generate   # drizzle-kit generate (schema.ts → drizzle/*.sql)
pnpm migrate    # drizzle-kit migrate
pnpm start      # production: node main.ts (needs build/)
```

**`pnpm dev` is not a Vite dev server.** `main.ts` imports the compiled
`build/server/index.js` and serves `build/client/`. Frontend changes under
`app/` are invisible until you run `pnpm build`; the `--watch` process then
restarts on the new bundle. Backend `.ts` changes reload directly.

`VITE_API_URL` is baked into the client bundle at build time (Vite reads
`api/.env`; Docker takes it as a build arg). It must equal the origin that
serves the app or the browser calls the wrong host.

### `packages/react/`

```bash
pnpm build   # tsup → dist/ (ESM + CJS + d.ts)
pnpm dev     # tsup --watch
```

### Validation checklist

Before considering any change complete, all of these must pass:

```bash
cd api && pnpm typecheck      # 1. types (runs the build internally)
cd api && pnpm lint           # 2. eslint
# 3. Docker image builds and serves HTTP 200 (from the repo root)
docker build -t meerkat:latest .
docker run --rm --env-file api/.env -p 8000:8000 meerkat:latest &
sleep 4 && curl -s http://localhost:8000 -o /dev/null -w "HTTP %{http_code}\n"
docker stop $(docker ps -q --filter ancestor=meerkat:latest)
```

## Dependency updates and the pnpm cooldown

pnpm 12 (pinned via `packageManager`) refuses to install any package version
published less than 24 hours ago (`minimumReleaseAge`, default 1440 minutes).
If `pnpm install` fails with `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` after a
dependency bump, keep the policy and re-resolve the lockfile instead:

```bash
pnpm clean --lockfile && pnpm install
```

pnpm then picks the newest versions that are old enough.

## Architecture

### One process, three layers

`api/main.ts` boots a single Hono server:

1. **Hono routes** (`api/routes/*.ts`) — each file is mounted at `/` and
   declares its own full paths, mostly `/api/v1/...`. Non-API paths also live
   here: `/stage/:stage` and `/stage/:stage/qa` redirect to the live (or next
   upcoming) event on a stage, for signage links. CORS (from `CORS_ORIGINS`) is
   applied only to `/api/*`.
2. **Static files** from `build/client/` (assets immutable-cached).
3. **React Router SSR handler** for everything else.

Request path: route → `models/*.ts` (Drizzle queries; the only place SQL
lives) → PostgreSQL on Supabase. `api/env.ts` validates env once at import and
throws on missing required vars.

### Frontend (`api/app/`)

React Router 8 in SSR mode with `prerender: false`, but **no server loaders or
actions** — layouts use `clientLoader` and pages use SWR (`hooks/fetcher.ts`),
so the server render is just the shell + `HydrateFallback`. Two layouts in
`app/routes.ts`:

- `layouts/page.tsx` — bare presenter view (`/e/:uid`), no auth.
- `layouts/app.tsx` — everything else; wraps `MeerkatProvider` (from the
  react package, `apiUrl=""`), Supabase client, `UserProvider`, Zupass
  `ZAPIProvider`, and the Chakra UI v3 system.

Theming is per conference: `conferences.theme` (JSONB) is turned into a
Chakra system by `app/theme/index.ts`; the loader fetches the event to pick
the theme. `conferences.features` rows are boolean feature flags surfaced as
`event.conference.features` (e.g. `collect` toggles the Event Card link).

### Auth and roles

- **Users**: Supabase Auth JWTs. Sign-in paths: email OTP, anonymous sign-in
  (username generated by `api/usernames.ts`), and Devcon SSO
  (`GET /api/v1/auth/devcon` verifies an HS256 token with `DEVCON_JWT_SECRET`,
  then mints a Supabase magic link with the service-role key). Protected
  routes use `middlewares/jwt.ts` (Hono `jwk()` against Supabase JWKS);
  `c.get("jwtPayload").sub` is the Supabase user id.
- **Roles**: `conference_role` (attendee/speaker/organizer) per conference.
  Organizer checks are done inline in each route via
  `getConferenceRolesForConference`. Roles are granted by a DB trigger on
  `auth.users` insert that claims matching `invitations` rows by email
  (migration 0002); `grantRole` in `models/roles.ts` has no callers.
- **Admin**: `middlewares/api-key.ts`, `x-api-key` header checked against
  argon2 hashes in `api_keys`. There is no endpoint to create keys; insert a
  hash directly. Admin routes batch-upsert events (keyed by `uid`) and create
  conferences; they exist for importing schedules from external systems.
- **Zupass is not auth.** It is only used by the collect flow: the server signs
  an attendance POD with `PRIVATE_KEY` (`api/zupass.ts`), the client inserts
  it into a Zupass collection via `@parcnet-js/app-connector` (`app/zapi/`).

### Domain rules worth knowing

- Question lifecycle is timestamp-driven: `selectedAt` (organizer picks it;
  selecting also marks the previously selected question answered),
  `answeredAt`, `deletedAt` (soft delete; queries filter it out). Banned users'
  questions are hidden by the query, not deleted.
- Exactly one event is live per stage: `setEventLive` flips the others off in
  a transaction.
- Rate limits live in `api/moderation.ts`; routes return 429, and the frontend
  turns 429 into a cooldown modal (`UserContext.isOnCooldown`).
- `auth.users` is Supabase-managed. `schema.ts` declares it (schema `auth`)
  only so Drizzle can join and set `banned_until`; migration 0000 has its
  `CREATE TABLE` commented out. **After `pnpm generate`, strip any
  `auth.users` DDL from the new migration.**

### Real-time (three mechanisms, all via Supabase Realtime)

1. **SSE questions stream** — `GET /api/v1/events/:uid/questions/stream`.
   Every mutation calls `broadcastQuestionsUpdate(eventId)`
   (`utils/broadcast.ts`), which POSTs to Supabase's REST broadcast API on
   topic `event-{id}`; each server instance holds one channel subscription
   per event and fans out an SSE `update` to its clients (30 s `ping`
   heartbeat). Consumed by `useQuestions`/`useEventSource` from the react
   package, both by external embedders and by the app itself (`QnA.tsx`,
   `Event.tsx`).
2. **`postgres_changes` from the browser** — reactions (`reactions` inserts
   filtered by event) and the moderation page (`questions` inserts). These
   need the tables in the `supabase_realtime` publication, which is
   configured in the Supabase dashboard, not in migrations.
3. **Live-event broadcasts** — `POST /api/v1/events/:uid/live` sends on
   `conference-{id}` and `stage-{stage}` channels with supabase-js;
   `useKeepLive` listens and also polls `/api/v1/events/stage/:stage/live`
   every 10 s so signage follows the schedule.

### Runtime constraints

- Node 24 runs `.ts` directly (type stripping): imports use explicit `.ts`
  extensions, `erasableSyntaxOnly` forbids enums/namespaces/parameter
  properties, ESM only, no `npm:`/`jsr:` specifiers.
- `@pcd/pod` and friends pull in CJS-only deps: server code imports them via
  the `createRequire` shim in `api/lib/pod.ts`, and `vite.config.ts` lists
  them in `ssr.noExternal`. This is also why `prerender` is off.
- `~/` aliases `api/app/`.

## Database changes

1. Edit `api/schema.ts` (single source of truth).
2. `cd api && pnpm generate`, then review the SQL (remove `auth.*` DDL).
3. `cd api && pnpm migrate`.
4. If a new table needs browser `postgres_changes`, add it to the realtime
   publication in Supabase.

## Code style

- Prefer `globalThis` over `window` (`globalThis.location`,
  `globalThis.crypto`).
- Ternary chains in JSX: condition on its own line, branches below, nested
  conditions continue at the same indent:
  ```tsx
  isLoading
    ? <Loading />
    : !data || data.length === 0
    ? <EmptyState />
    : <DataView />
  ```
- Data hooks: `app/hooks/use-<resource>.ts`, SWR + `hooks/fetcher.ts`, return
  `{ data, isLoading, error, mutate }`. Mutations use `swr/mutation` with
  `poster`, passing `session?.access_token`.
- Build internal URLs with `qa(uid)` / `card(uid)` from `app/routing.ts`.
- ESLint: `no-explicit-any` is an error; prefix intentionally unused
  identifiers with `_`.

## Git workflow

- Several worktrees run in parallel against this repo. Never use bare
  `git stash` / `git stash pop`; prefer a WIP commit, or
  `git stash push -m "<tag>"` and apply by SHA.
- A local (untracked) pre-commit hook lints staged `api/**/*.ts(x)` with
  `eslint --fix`; it silently skips when `api/node_modules` is missing, so
  run `pnpm install` in a fresh worktree to get lint-on-commit.

## Deployment

Fly.io through `.github/workflows/continous-deployment.yml`: push to `master`
deploys the `dev` environment, creating a GitHub release deploys `prod`.
`fly.template.toml` is rendered with `envsubst` from GitHub secrets; the
health check hits `/api/v1/conferences`. `.github/workflows/sync.yml` is a
stale manual workflow from the Deno era (`deno task sync` no longer exists).

## Environment variables (`api/.env`)

| Variable                    | Notes                                                        |
| --------------------------- | ------------------------------------------------------------ |
| `DATABASE_URL`              | Required unless `DATABASE_POOLER_URL` is set (pooler wins)   |
| `PRIVATE_KEY`               | Required; signs attendance PODs only (`openssl rand -hex 32`)|
| `DEVCON_JWT_SECRET`         | Required; HS256 secret for Devcon SSO tokens                 |
| `SUPABASE_SERVICE_ROLE_KEY` | Required; REST broadcast + magic-link generation             |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Optional in code, but without them there is no auth and no realtime |
| `BASE_URL`                  | Public origin; used for redirects, QR codes, POD type prefix |
| `VITE_API_URL`              | Build-time client API origin (see Commands)                  |
| `CORS_ORIGINS`              | Comma-separated allowed origins for `/api/*`; default `*`    |
| `ZUPASS_URL`, `ZUPASS_ZAPP_NAME` | Zupass connector config                                 |
| `SENTRY_DSN`, `ENVIRONMENT`, `DATABASE_MAX_POOL_SIZE` | Optional                              |
