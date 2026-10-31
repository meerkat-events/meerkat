# CLAUDE.md

## What Meerkat is

Audience-engagement (Q&A) tool for conferences, used by the Ethereum
Foundation for Devcon/Devconnect. Attendees open `/e/:uid/qa` on their phones
to ask, upvote and react; organizers select/answer/delete questions and put an
event "live"; a presenter view at `/e/:uid` runs on the stage screen.

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
  passwords, connection strings) or infrastructure
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
  gitignored `.backups/`. Logs carry ids (`userId`, question `uid`) and may
  carry question text, but never email addresses, secrets, tokens or query
  strings (the Devcon handover token travels in one); log
  errors under `err` (`api/logger.ts` keeps message, code and stack and
  drops query parameters), never in another field.
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

Before calling a code change done, all of this must pass, from the repo root:

```bash
pnpm --dir api typecheck && pnpm --dir api lint && pnpm --dir api test
# Docker image builds and serves HTTP 200. Per-checkout name and a random
# host port, so parallel worktrees don't collide.
tag="meerkat-$(basename "$PWD")"
docker build -t "$tag" .
docker run -d --rm --name "$tag" --env-file api/.env -p 127.0.0.1::8000 "$tag"
curl -s --retry 10 --retry-all-errors --retry-delay 1 -o /dev/null -w "HTTP %{http_code}\n" "http://$(docker port "$tag" 8000)"
docker stop "$tag"
```

New tests use Node's built-in runner, `node:test` with `node:assert`;
`node --test` picks up `*.test.ts` files directly (`pnpm --dir api test`).
CI (`.github/workflows/ci.yml`) runs the unit and integration tests on every
pull request and before every deploy, which waits for them to pass.

Integration tests (`api/integration/*.int.ts`, outside `node --test`'s
default globs) run against the local Supabase CLI stack, never a cloud
project: `pnpm --dir api test:integration` (`scripts/test-integration.sh`)
needs Docker, starts the stack, migrates, applies the policies and runs them
with an environment of its own, not `api/.env`. The stack is shared by every
worktree, and the tests empty its tables. Run them for changes to auth,
authorization or rate limits; `integration/helpers.ts` resets the database,
seeds conferences and signs users in with real local tokens.

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
  package, `apiUrl=""`), Supabase client, `UserProvider`, Chakra system.

Server-only code for loaders lives in `.server.ts` modules (the build fails if
client code imports one). The server build doesn't bundle the server modules
outside `app/` (`db.ts`, `models/`, `env.ts`, `logger.ts`, …): `vite.config.ts`
keeps them external, so the built loaders import the same source files
`main.ts` runs and share Hono's instances, including its one database pool.
Loaders may therefore call `models/` directly.

Theming is per conference: `conferences.theme` (JSONB) becomes a Chakra
system in `app/theme/index.ts`; the layouts' `clientLoader` fetches the event
to pick it. Rows in the `features` table are per-conference flags, surfaced
as `event.conference.features` (`supervotes` turns on supervotes,
`attendees_only` limits taking part to people with a role; its name lives in
the DB-free `api/features.ts`, which the loader and the client import too).

### Auth and roles

- **Sign-in** yields a Supabase Auth session in exactly three ways: anonymous
  (username from `api/usernames.ts`), the code or
  link from a sign-in email (`app/hooks/use-otp.ts`), and the **Devcon
  handover**.
  The Devcon event app sends ticket holders to `/e/:uid/qa?token=<jwt>`; the
  server `loader` in `app/routes/QnA.tsx` verifies the HS256 token
  (`api/devcon.ts`, secret `DEVCON_VERIFICATION_SECRET`, which is the Devcon
  app's `VERIFICATION_SECRET`). Its `iat`/`exp` are **milliseconds**, so
  `hono/jwt`'s time checks are off and expiry is checked separately. The
  loader then mints a session (`app/lib/handover.server.ts`), grants the
  attendee role in the event's conference if it is attendees-only (never
  overwriting an existing role) and
  redirects with the session in the URL fragment, which the browser's
  Supabase client adopts;
  failures redirect with `?handover=expired|invalid|failed`. The route's
  `clientLoader` forces a document load for token URLs. No API endpoint is
  involved. Minting calls Supabase's per-IP rate-limited `/verify` from our
  servers; with `SUPABASE_SECRET_KEY` set it forwards the attendee's
  `Fly-Client-IP` in `sb-forwarded-for`, so the limit applies per attendee
  (needs IP Address Forwarding enabled in the project). Spec:
  https://github.com/efdevcon/monorepo/blob/main/event-app/src/app/api/meerkat/README.md
- **API auth: every route requires a JWT unless it is on the public list.**
  Protected routes put `jwt()` from `middlewares/jwt.ts` first (Hono `jwk()`
  against Supabase's JWKS, cached for 10 minutes), so a request without a
  token gets 401 before anything else runs; `c.get("jwtPayload").sub` is
  the user id. A route is public only when someone without a Meerkat
  session needs it:
  - **guests** (the Q&A page before signing in, which signs in anonymously
    only when they ask or vote, and the presenter view `/e/:uid`, which
    has no auth at all) and **embedders** (`packages/react`):
    `GET /api/v1/events/:uid` (also the layouts' `clientLoader`, for
    theming), `/api/v1/events/:uid/questions` and its `/stream`,
    `GET /api/v1/events` (the Q&A page's session switcher), and
    `/e/:uid/card`, which redirects old Event Card links to the Q&A page;
  - **signage**: `/stage/:stage`, `/stage/:stage/qa`,
    `GET /api/v1/events/stage/:stage/live` (`useKeepLive`) and
    `GET /api/v1/conferences/:id/live` (printed QR codes; redirects only);
  - **login**: `GET /api/v1/config` (the Supabase URL and anon key); sign-in
    itself goes straight to Supabase Auth, and the Devcon handover is a
    page loader, not an API route;
  - **infrastructure**: `GET /api/v1/health` (Fly's health check) and
    `POST /api/v1/pretalx/:event/sync` (see Pretalx sync).

  Admin routes use an API key instead (below). Public responses never
  carry hidden questions, moderation fields or emails (`toPublicQuestion`,
  `toApiConference`). `api/app.test.ts` holds the same list and checks that
  every other route answers 401 without credentials, so a new public route
  has to be added there on purpose. On the frontend, a hook calling a
  protected route passes `session?.access_token` and keeps its SWR key
  `null` until there is one. `optionalJwt()` sets the payload when a valid
  token is present and otherwise lets the request through anonymously (the
  question list uses it to include the viewer's own hidden questions and
  their `vote` on each question).
- **Roles** (`conference_role`: attendee/organizer/moderator, per conference)
  are granted by a DB trigger on `auth.users` insert that claims matching
  `invitations` rows by email (migration 0002), and by the Devcon handover
  (attendee, attendees-only conferences only). An invitation for an email
  that already has an account isn't claimed; insert its `conference_role`
  row directly. Organizers and
  moderators moderate the Q&A (select, answer, hide, go live, block):
  routes check `canModerate` (`models/roles.ts`) on the roles from
  `getConferenceRolesForConference`. Only organizers see the management
  pages (`/manage`, `requireOrganizer` in `routes/conferences.ts`) and can
  restore moderation-hidden questions. `/login` is the one sign-in page:
  after `?next=`, organizers land on `/manage` and everyone else on
  `/account`, where moderators pick a talk (`homeFor`).
- **Admin API**: `x-api-key` header checked against argon2 hashes in
  `api_keys` (`middlewares/api-key.ts`); no endpoint creates keys. Admin
  routes create conferences and batch-upsert events by `uid`, for importing
  schedules.

### Domain rules

- Questions are timestamp-driven: `selectedAt` (selecting one marks the
  previously selected one answered), `answeredAt`, `deletedAt` (soft delete;
  queries filter it out). Banned users' questions are hidden by the query, not
  deleted.
- One live event per stage: `setEventLive` turns the others off in a
  transaction. Event upserts never overwrite `live`.
- **Attendees-only conferences** (`attendees_only` feature, Devcon 8): asking,
  voting (also removing a vote) and reacting need a role in the conference
  (`mayParticipate` in `models/roles.ts`; 403 otherwise, checked after the ban check and before
  the rate limits). Reads stay public. The Q&A page offers no anonymous
  sign-in there and tells people without a role to open the session from
  the conference app.
- Rate limits are constants in `api/moderation.ts`; routes answer 429, with a
  `Retry-After` for limits over a time window (`utils/too-many-requests.ts`),
  and the frontend shows a cooldown modal with the reason and the time left
  (`UserContext.cooldown`).
- **Votes are weighted**: `votes.weight` is 1, or `SUPERVOTE_WEIGHT` (3) for
  a supervote. A question's vote total is the sum of the weights; every
  query that shows one uses `voteTotal`/`voteTotalOf` from `models/votes.ts`,
  so the Q&A page, the stage screen and the organizer views agree (activity
  stats counting votes cast use `COUNT`). The question list
  fetched with a token gives each question the viewer's `vote: { weight }`
  or null; the Q&A page reads its vote state from there. No other response
  carries `vote`.
- **Supervotes** (`models/supervotes.ts`, conferences with the `supervotes`
  feature) live in one stored balance per user across all conferences
  (`supervote_balances`, `CHECK balance >= 0`). Selecting a question earns
  its author one, the first time only. Spending one (`POST
  /api/v1/questions/:uid/upvote` with `{ "weight": 3 }`) lowers the balance
  only while it's above 0 and inserts the vote in the same transaction; 409
  when none is left. A supervote is spent once and can't be removed (the
  toggle answers 409, and the UI disables the gold pill); deleting the
  question refunds everyone who supervoted it, in the delete's transaction. `GET /api/v1/users/me/supervotes` returns
  `{ available, weight }`.
- **Points** (`models/points.ts`) are per conference and come only from
  others: 5 per question selected or answered, 1 per vote received
  (weighted, so a supervote is 3 votes; own votes don't count). Tiers
  (`api/tiers.ts`: top 0.1/1/10/25%) rank against everyone who asked or
  voted; ties share the better tier, 0 points has none, and nobody has one
  below `MIN_CONTRIBUTORS` (20) contributors. There is no
  leaderboard: `GET /api/v1/conferences/:id/participants/:userId` (signed-in
  users only) returns one person, fetched when their name on a question is
  tapped (names aren't tappable for guests), and for the
  signed-in user only when their questions' votes or picks change
  (`useOwnTier`), to celebrate moving into a better tier (last tier seen is
  kept in localStorage, so dropping out and back in celebrates again).
- **Automatic moderation** (design: `designs/002-question-moderation.md`):
  for a conference with a `conferences.moderation` config (written context,
  optional `instructions`/`criteria` overrides; null = off), the create route
  classifies each new question before inserting it (`moderate-question.ts`,
  `classifier.ts`: OpenRouter Decisions API, pinned model, 1.5 s timeout).
  A question is hidden (`hidden_at`) when `decide` returns "hide": the
  probability that it is not `none`, or the "yes" of one of four yes/no
  questions in the same request (`POLITICS_QUESTION`: politics unrelated to
  crypto outside political talks; `WAR_QUESTION`: current wars, conflicts,
  genocide; `SAFETY_QUESTION`: threats, doxxing, explicit content;
  `SELF_HARM_QUESTION`), reaches `MODERATION_THRESHOLDS.hide`; a lower band
  is stored as "review". A provider refusal hides the question; any other
  error, or no `OPENROUTER_API_KEY`, fails open. A `relevance` score (0-4,
  `buildRelevanceQuestion`) and the decision are stored in
  `questions.moderation`. Every classifier call
  writes one structured log line after the insert (`logModerationCall`:
  outcome, decision, scores, duration, tokens, cost; no question text). Hidden questions are
  shadow-hidden: only their author sees them (`getQuestions` with `viewerId`, `useEventQuestions` on the Q&A
  page), and organizers on the management pages, which review them; every
  other query, the Realtime policy and all public responses
  (`toPublicQuestion`, `toApiConference`) leave them and the moderation
  fields out. Organizers get only a summary of the verdict (decision,
  reasons, relevance; `moderation-summary.ts`), never raw scores, and can
  restore a hidden question (`POST /api/v1/questions/:uid/restore`, which
  keeps the verdict, so "hide" without `hidden_at` reads as restored); one
  can't be selected for the stage while hidden. Counts of session activity
  leave hidden questions out; Analytics adds moderation totals and relevance.
  The react package never sees hidden questions, because embedders don't
  ask questions.
- **The moderation eval is the gate.** Any change to `MODERATION_MODEL`,
  the thresholds, the default criteria, the topic questions or a
  conference's moderation config must pass
  `node --env-file=.env scripts/moderation-eval.ts` in `api/` (exit 0).
  Its committed cases (`scripts/moderation-cases.json`) are invented;
  labeled real questions run from a gitignored case file in `.backups/`.
- **Pretalx sync** (`api/pretalx.ts`): a conference with a `pretalx_event`
  slug gets one event per talk in that Pretalx event's public schedule
  (`uid` = submission code, which the Devcon app links to; `stage` =
  slugified room). Talks gone from Pretalx are deleted unless the event is
  live or has questions. `POST /api/v1/pretalx/:event/sync` is deliberately
  unauthenticated, the only public write (it only re-pulls a public
  schedule), and throttled to one
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
   (`use-reactions-subscription`) and question and vote changes on the
   management pages (`useConferenceQuestions`). Their tables need a SELECT
   policy and membership in the `supabase_realtime` publication (see
   Database changes); the questions policy excludes rows hidden by
   moderation.
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
- `~/` aliases `api/app/`.

## Database changes

1. Edit `api/schema.ts`, the single source of truth. **A new table ends in
   `.enableRLS()`**, so its migration enables Row Level Security
   (`api/schema.test.ts` fails otherwise): the anon key is public. The
   Data API (PostgREST) is also off (`[api] enabled = false` in
   `supabase/config.toml`); nothing uses it, and keeping it off is the
   second line of defense.
2. Run `pnpm generate` in `api/` and review the SQL. **Delete any
   `auth.users` DDL** from the new migration.
3. Run `pnpm migrate` for your local database. Deployments migrate
   themselves (see Deployment).
4. A table the browser subscribes to (`postgres_changes`) also needs the
   "Realtime" SELECT policy and the `supabase_realtime` publication, in
   `api/scripts/supabase-policies.sql`, the Supabase setup Drizzle doesn't
   manage. The script is idempotent; run it on every new Supabase project
   after the first migration, and after changing it:
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
- Internal URLs come from `qa(uid)` in `app/routing.ts`.
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
`DATABASE_POOLER_URL`. The health check hits `/api/v1/health` (public; a
`SELECT 1`, so it fails while the database is unreachable).
`.github/workflows/sync.yml` runs a Pretalx sync by hand and needs the
`MEERKAT_BASE` secret in the chosen environment.
