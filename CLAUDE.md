# CLAUDE.md

## What Meerkat is

Audience-engagement (Q&A) tool for conferences, used by the Ethereum
Foundation for Devcon/Devconnect. Attendees open `/e/:uid/qa` on their phones
to ask, upvote and react; organizers select/answer/delete questions and put an
event "live"; a presenter view at `/e/:uid` runs on the stage screen. An
optional "collect" feature lets attendees store a signed attendance POD in
their Zupass.

## Repository layout

pnpm workspace on Node.js 26. Node 26 ships no corepack: pnpm comes from its
own installer and switches itself to the version in `packageManager`.

- **`api/`** (package name `ui`) — the whole application: Hono HTTP API,
  React Router 8 SSR frontend, Drizzle schema and migrations.
- **`packages/react/`** — `@meerkat-events/react`, a published npm package of
  hooks for embedding Meerkat questions in other sites (background:
  [designs/001-devcon-ui-integration.md](designs/001-devcon-ui-integration.md)).
  `api/` consumes it from its `dist/`, so **build it before building or
  typechecking `api/`**, and again after changing it.

## Ground rules

- **This repository is public.** Never commit secrets (keys, JWTs,
  `PRIVATE_KEY` values, passwords, connection strings) or infrastructure
  identifiers (Supabase project refs, org IDs, Fly app or org names); docs
  use placeholders such as `<project-ref>`. Real values belong in `api/.env`
  (gitignored) and GitHub/Fly secrets. Stage files by path, not with
  `git add -A`, and check before committing:
  `git diff --cached | grep -nE '\b[a-z]{20}\b|eyJ[A-Za-z0-9_-]{20,}|postgres(ql)?://'`
- **Readability and maintainability over cleverness.** Write the obvious
  version: plain control flow, descriptive names, small functions; no
  one-liner tricks, clever generics or abstractions with a single caller.
- **No real attendee data in the repository.** Questions from production
  dumps contain personal data (self-identifying handles, named third
  parties). Never commit them, quoted or paraphrased, not even as test
  cases; describe them instead. Dumps and derived files live in the
  gitignored `.backups/`.
- **Platform first.** Use Node and Web built-ins before reaching for a
  package: `node:test` + `node:assert`, `fetch`, `URL`, `globalThis.crypto`,
  `structuredClone`, `Intl`.

## Dependencies

- Add a dependency only if it is the **de facto standard** for the job (what
  most of the ecosystem uses, actively maintained) and neither the platform
  nor an existing dependency does the job reasonably.
- Add it at the **latest version**: `pnpm add <pkg>` without a version,
  never a version from memory. The two exceptions follow.
- **TypeScript stays on 6.x** until typescript-eslint supports 7: its peer
  range ends at `<6.1.0`, and TypeScript 7.0 has no programmatic API (planned
  for 7.1), which tsup's `dts` build and `react-router typegen` also need.
- **pnpm's 24-hour cooldown.** pnpm 12 refuses versions published less than
  24 hours ago (`minimumReleaseAge`). If an install fails with
  `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`, keep the policy and re-resolve:
  `pnpm clean --lockfile && pnpm install` picks the newest versions that are
  old enough.

## Commands

```bash
./scripts/setup.sh           # first-time setup (see README): install, build, migrate, seed
./scripts/worktree-setup.sh  # bring a checkout up to date: api/.env, install, build both packages
```

In `api/`:

```bash
pnpm dev        # node --env-file=.env --watch main.ts, on $PORT (default 8000)
pnpm build      # react-router build → build/client + build/server
pnpm typecheck  # react-router typegen + build + tsc --noEmit
pnpm lint       # eslint
pnpm generate   # drizzle-kit generate: schema.ts → drizzle/*.sql
pnpm migrate    # drizzle-kit migrate, against DATABASE_URL
```

In `packages/react/`: `pnpm build` (tsup → `dist/`) or `pnpm dev` (watch).

**`pnpm dev` is not a Vite dev server.** `main.ts` serves the compiled
`build/`, so changes under `app/` show up only after `pnpm build` (the
`--watch` process then restarts on the new bundle). Backend `.ts` changes
reload directly.

`VITE_API_URL` is compiled into the client at build time. Leave it empty (the
default) and the frontend calls the origin that served it, so one build works
on any port; set it only when frontend and API are on different origins. Read
it only through `app/lib/api-url.ts` (`apiUrl()`, `appOrigin()`).

## Validation

There is no test suite yet. Before calling a code change done, all of this
must pass, from the repo root:

```bash
pnpm --dir api typecheck && pnpm --dir api lint
# Docker image builds and serves HTTP 200. Per-checkout name and a random
# host port, so parallel worktrees don't collide.
tag="meerkat-$(basename "$PWD")"
docker build -t "$tag" .
docker run -d --rm --name "$tag" --env-file api/.env -p 127.0.0.1::8000 "$tag"
curl -s --retry 10 --retry-all-errors --retry-delay 1 -o /dev/null -w "HTTP %{http_code}\n" "http://$(docker port "$tag" 8000)"
docker stop "$tag"
```

New tests use Node's built-in runner, `node:test` with `node:assert`;
`node --test` picks up `*.test.ts` files directly.

## Architecture

### Server: one Hono process

`api/main.ts` serves, in order:

1. **API routes** (`api/routes/*.ts`, mounted in `app.ts`). Each file declares
   its own full paths, mostly `/api/v1/...`. The signage redirects
   `/stage/:stage` and `/stage/:stage/qa` (to the live or next event on a
   stage) live here too. CORS (`CORS_ORIGINS`, default `*`) applies to
   `/api/*` only.
2. **Static files** from `build/client/` (`/assets/*` cached immutable).
3. **React Router SSR** for everything else.

Routes call `models/*.ts`, the only place with SQL (Drizzle), against
Postgres on Supabase. `api/env.ts` reads all of the app's environment
variables and throws at import when a required one is missing; it and
`api/.env.example` are the reference for every variable.

### Frontend (`api/app/`)

React Router 8 in SSR mode with `prerender: false`, Chakra UI v3, SWR. Layouts
load data in `clientLoader` and pages fetch with SWR, so the server renders
only the shell and `HydrateFallback`. The one server `loader` is the Devcon
handover in `routes/QnA.tsx`. Two layouts in `app/routes.ts`:

- `layouts/page.tsx` — bare presenter view (`/e/:uid`), no auth.
- `layouts/app.tsx` — everything else: `MeerkatProvider` (from the react
  package, `apiUrl=""`), Supabase client, `UserProvider`, Zupass
  `ZAPIProvider`, Chakra system.

Server-only code for loaders lives in `.server.ts` modules (the build fails if
client code imports one). Whatever such a module imports from outside `app/`
(`env.ts`, `logger.ts`, …) is bundled as a separate **copy**, not the
instance Hono uses: keep loaders away from `db.ts` (a copy would open a
second connection pool) and keep those modules free of import-time side
effects.

Theming is per conference: `conferences.theme` (JSONB) becomes a Chakra
system in `app/theme/index.ts`; the layouts' `clientLoader` fetches the event
to pick it. Rows in the `features` table are per-conference flags, surfaced
as `event.conference.features` (`collect` shows the Event Card link).

### Auth and roles

- **Sign-in** yields a Supabase Auth session in exactly three ways: anonymous
  (username from `api/usernames.ts`), email OTP, and the **Devcon handover**.
  The Devcon event app sends ticket holders to `/e/:uid/qa?token=<jwt>`; the
  server `loader` in `app/routes/QnA.tsx` verifies the HS256 token
  (`api/devcon.ts`, secret `DEVCON_VERIFICATION_SECRET`, which is the Devcon
  app's `VERIFICATION_SECRET`). Its `iat`/`exp` are **milliseconds**, so
  `hono/jwt`'s time checks are off and expiry is checked separately. The
  loader then mints a session (`app/lib/handover.server.ts`) and redirects
  with it in the URL fragment, which the browser's Supabase client adopts;
  failures redirect with `?handover=expired|invalid|failed`. The route's
  `clientLoader` forces a document load for token URLs. No API endpoint is
  involved. Minting calls Supabase's per-IP rate-limited `/verify` from our
  servers; with `SUPABASE_SECRET_KEY` set it forwards the attendee's
  `Fly-Client-IP` in `sb-forwarded-for`, so the limit applies per attendee
  (needs IP Address Forwarding enabled in the project). Spec:
  https://github.com/efdevcon/monorepo/blob/main/event-app/src/app/api/meerkat/README.md
- **API auth**: protected routes use `jwt()` from `middlewares/jwt.ts` (Hono
  `jwk()` against Supabase's JWKS, cached for 10 minutes);
  `c.get("jwtPayload").sub` is the user id. `optionalJwt()` sets the payload
  when a valid token is present and otherwise lets the request through
  anonymously (the question list uses it to include the viewer's own hidden
  questions).
- **Roles** (`conference_role`: attendee/speaker/organizer, per conference)
  are granted only by a DB trigger on `auth.users` insert that claims
  matching `invitations` rows by email (migration 0002). Routes check
  organizer rights inline with `getConferenceRolesForConference`.
- **Admin API**: `x-api-key` header checked against argon2 hashes in
  `api_keys` (`middlewares/api-key.ts`); no endpoint creates keys. Admin
  routes create conferences and batch-upsert events by `uid`, for importing
  schedules.
- **Zupass is not auth.** It only serves the collect flow: the server signs an
  attendance POD with `PRIVATE_KEY` (`api/zupass.ts`) and the client adds it
  to a Zupass collection (`app/zapi/`).

### Domain rules

- Questions are timestamp-driven: `selectedAt` (selecting one marks the
  previously selected one answered), `answeredAt`, `deletedAt` (soft delete;
  queries filter it out). Banned users' questions are hidden by the query, not
  deleted.
- One live event per stage: `setEventLive` turns the others off in a
  transaction. Event upserts never overwrite `live`.
- Rate limits are constants in `api/moderation.ts`; routes answer 429 and the
  frontend shows a cooldown modal (`UserContext.isOnCooldown`).
- **Automatic moderation** (design: `designs/002-question-moderation.md`):
  for a conference with a `conferences.moderation` config (written context,
  optional `instructions`/`criteria` overrides; null = off), the create route
  classifies each new question before inserting it (`moderate-question.ts`,
  `classifier.ts`: OpenRouter Decisions API, pinned model, 1.5 s timeout).
  A question is hidden (`hidden_at`) when the probability that it is not
  `none` reaches `HIDE_THRESHOLD`, or when one of two yes/no questions in the
  same request (`POLITICS_QUESTION`: politics unrelated to crypto outside
  political talks; `WAR_QUESTION`: current wars, conflicts, genocide) reaches
  `TOPIC_THRESHOLD` (`shouldHide`). It fails open on any error or without
  `OPENROUTER_API_KEY`. Hidden questions are shadow-hidden: only their author
  sees them (`getQuestions` with `viewerId`, `useEventQuestions` on the Q&A
  page); every other query, the Realtime policy and all responses
  (`toPublicQuestion`, `toApiConference`) leave them and the moderation
  fields out. The react package never sees hidden questions, because
  embedders don't ask questions.
- **The moderation eval is the gate.** Any change to `MODERATION_MODEL`,
  the thresholds, the default criteria, the topic questions or a
  conference's moderation config must pass
  `node --env-file=.env scripts/moderation-eval.ts` in `api/` (exit 0). Its committed cases (`scripts/moderation-cases.json`) are invented;
  labeled real questions run from a gitignored case file in `.backups/`.
- **Pretalx sync** (`api/pretalx.ts`): a conference with a `pretalx_event`
  slug gets one event per talk in that Pretalx event's public schedule
  (`uid` = submission code, which the Devcon app links to; `stage` =
  slugified room). Talks gone from Pretalx are deleted unless the event is
  live or has questions. `POST /api/v1/pretalx/:event/sync` is deliberately
  unauthenticated (it only re-pulls a public schedule) and throttled to one
  sync per conference per minute across instances
  (`conferences.pretalx_synced_at`). Callers: the Devcon team's webhook and
  `.github/workflows/sync.yml` (manual).
- `auth.users` belongs to Supabase; `schema.ts` declares it only so Drizzle
  can join it and set `banned_until`.

### Real-time (all through Supabase Realtime)

1. **SSE question stream**: `GET /api/v1/events/:uid/questions/stream`.
   Every question mutation calls `broadcastQuestionsUpdate(eventId)`
   (`utils/broadcast.ts`), which posts to Supabase's REST broadcast API on
   topic `event-{id}`; each server instance holds one subscription per event
   and pushes an SSE `update` to its clients (`ping` every 30 s). Consumed
   with `useQuestions`/`useEventSource` from the react package by embedders
   and `Event.tsx`; `QnA.tsx` uses `useEventQuestions`, which sends the
   session token, plus the package's `useEventSource`.
2. **`postgres_changes` in the browser**: reactions on the presenter view
   (`use-reactions-subscription`) and new questions on the moderation page
   (`useAllQuestions`). Their tables need a SELECT policy and membership in
   the `supabase_realtime` publication (see Database changes); the questions
   policy excludes rows hidden by moderation.
3. **Live-event broadcasts**: `POST /api/v1/events/:uid/live` sends on
   `conference-{id}` and `stage-{stage}`; `useLiveEventSubscription` and
   `useKeepLive` listen, and `useKeepLive` also polls
   `/api/v1/events/stage/:stage/live` every 10 s so signage follows the
   schedule.

### Runtime constraints

- Node 26 runs `.ts` directly (type stripping): ESM only, explicit `.ts`
  extensions in local imports, and `erasableSyntaxOnly` (no enums,
  namespaces or parameter properties). Packages are imported by plain npm
  name, never with `npm:`/`jsr:` specifiers.
- `tsconfig.json` extends `@tsconfig/strictest`, including
  `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` and
  `noPropertyAccessFromIndexSignature` (hence `process.env["X"]`).
- `@pcd/pod` and friends pull in CJS-only dependencies: server code imports
  them through the `createRequire` shim in `api/lib/pod.ts`, and
  `vite.config.ts` bundles them via `ssr.noExternal`. This is also why
  `prerender` is off.
- `~/` aliases `api/app/`.

## Database changes

1. Edit `api/schema.ts`, the single source of truth.
2. Run `pnpm generate` in `api/` and review the SQL. **Delete any
   `auth.users` DDL** from the new migration.
3. Run `pnpm migrate` for your local database. Deployments migrate
   themselves (see Deployment) while the previous version is still serving,
   so a migration must work with the old code: add columns freely; renames
   and drops take two deploys.
4. A new table also goes into `api/scripts/supabase-policies.sql`, which
   holds the Supabase setup Drizzle doesn't manage. Every table needs Row
   Level Security there, because the anon key is public and PostgREST
   exposes the `public` schema. Tables the browser subscribes to also need
   the "Realtime" SELECT policy and the `supabase_realtime` publication. The
   script is idempotent; run it on every new Supabase project after the
   first migration, and after changing it:
   `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f api/scripts/supabase-policies.sql`

All worktrees share one Supabase database (`api/.env` is copied, not
per-worktree), so `pnpm migrate` from one branch changes the schema under
every other worktree. Coordinate before migrating.

Project settings (auth, pooler, rate limits, the two auth email templates)
live in `supabase/config.toml`; [supabase/README.md](supabase/README.md) is
the runbook for a new project. `supabase config push` writes every key the
file declares and leaves undeclared (commented) keys alone, so per-project
values such as `site_url` and the redirect URLs stay commented. Always run
`supabase config diff` first: `update`/`local_only` rows will be written,
`remote_only` rows won't.

## Code style

- `globalThis` over `window` (`globalThis.location`, `globalThis.crypto`).
- JSX ternary chains: condition on its own line, branches below, nested
  conditions continue at the same indent:
  ```tsx
  isLoading
    ? <Loading />
    : !data || data.length === 0
    ? <EmptyState />
    : <DataView />
  ```
- Data hooks: `app/hooks/use-<resource>.ts`, SWR with `hooks/fetcher.ts`,
  returning `{ data, isLoading, error }` (plus `mutate` when callers need
  it). Mutations use `swr/mutation` with `poster` or `deleter`, passing
  `session?.access_token`.
- Internal URLs come from `qa(uid)` / `card(uid)` in `app/routing.ts`.
- ESLint: `no-explicit-any` is an error; prefix intentionally unused
  identifiers with `_`.

## Git workflow

- Several worktrees work on this repo in parallel. Never use bare
  `git stash` / `git stash pop`; prefer a WIP commit, or
  `git stash push -m "<tag>"` and apply by SHA.
- Stack dependent changes with [`gh stack`](https://gh.io/stacks)
  (`gh extension install github/gh-stack`): when a change builds on another
  unmerged one, add it as a layer instead of branching from `master`, so each
  PR shows only its own diff. Keep each layer small and reviewable on its own.
  ```bash
  gh stack init feat/a               # or adopt existing branches: gh stack init feat/a feat/b
  git add <paths>                    # stage by path; -A would sweep in untracked files
  gh stack add -m "feat: b" feat/b   # new layer on top, committing what is staged
  gh stack submit --auto --open      # push all, create/update the PRs, ready for review
  gh stack sync                      # after a merge or review fixes: rebase the stack, push
  ```
  `modify` and `switch` are interactive; move with `gh stack up`, `down` or
  `checkout <branch>` instead.
- A local pre-commit hook (in `.git/hooks`, untracked) runs `eslint --fix` on
  staged `api/` files and re-stages the fixes.
- **Worktrees bootstrap themselves.** `.worktreeinclude` copies the
  gitignored `api/.env` into worktrees Claude Code creates, and the
  `SessionStart` hook in `.claude/settings.json` runs
  `scripts/worktree-setup.sh --if-needed`, which installs and builds
  whatever is missing. After switching branches or pulling dependency or
  frontend changes, run `./scripts/worktree-setup.sh` without the flag.
- **Each worktree runs its own dev server.** `main.ts` listens on `PORT`
  (default 8000; a `PORT` in the environment wins over `.env`).
  `.claude/launch.json` sets `autoPort`, so the desktop app's preview gets a
  free port; elsewhere run `PORT=<free port> pnpm dev`. Never test against a
  server you didn't start: it may serve another worktree's branch. Find the
  owner with `lsof -nP -iTCP:<port> -sTCP:LISTEN`, then
  `lsof -p <pid> | grep cwd`.

## Deployment

Fly.io via `.github/workflows/continous-deployment.yml`: a push to `master`
deploys `dev`, a GitHub release deploys `prod`. `fly.template.toml` is
rendered with `envsubst` from GitHub secrets. Its `release_command` runs
`api/migrate.ts` once per deploy, before the rollout, and a failed migration
aborts the deploy; unlike the app, `migrate.ts` prefers `DATABASE_URL` over
`DATABASE_POOLER_URL`. The health check hits `/api/v1/conferences`.
`.github/workflows/sync.yml` runs a Pretalx sync by hand and needs the
`MEERKAT_BASE` secret in the chosen environment.
