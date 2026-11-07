## Meerkat

The audience engagement tool for in-person and virtual conferences, used by the
Ethereum Foundation for Devcon, Devconnect, and others.

Attendees scan a QR code to ask and upvote questions and send reactions.
Organizers pick the question being answered and mark the current session as
live. A presenter view runs on the stage screen and follows the live session.

### Repository

| Path               | What it is                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| `api/`             | The application: Hono HTTP API, React Router 8 frontend (SSR), Drizzle schema and migrations      |
| `packages/react/`  | [`@meerkat-events/react`](packages/react/README.md) — hooks to embed live questions in your own site |
| `scripts/setup.sh` | One-shot local setup                                                                              |

## Prerequisites

- [Node.js 26](https://nodejs.org/). It no longer ships corepack, so install
  pnpm with its own installer (`curl -fsSL https://get.pnpm.io/install.sh | sh -`,
  see [pnpm installation](https://pnpm.io/installation)); pnpm then switches
  itself to the version pinned in `packageManager`. `./scripts/setup.sh` does
  this for you
- A [Supabase](https://supabase.com) project — it provides Postgres and Auth
- `psql`, used by the seed script
- Docker, only if you want to build the production image locally

## Get started

1. Create `api/.env` from the example and fill in the values (see
   [Environment variables](#environment-variables)):

   ```bash
   cp api/.env.example api/.env
   ```

2. Run the setup script from the repository root:

   ```bash
   ./scripts/setup.sh
   ```

   It installs dependencies, builds the workspace packages, applies the
   database migrations and seeds two demo conferences with events. It is safe
   to re-run and leaves an existing `api/.env` untouched.

3. Configure the Supabase project. `supabase/config.toml` reproduces the
   provider, OTP and rate-limit settings below with `supabase config push`;
   [supabase/README.md](supabase/README.md) has the runbook and lists what
   stays manual.

   - **Auth → Providers**: enable **Email** and **Anonymous sign-ins**. Login
     uses a one-time code, so the magic-link email template must include
     `{{ .Token }}`.
   - **Auth → URL Configuration**: set the Site URL and redirect URLs to the
     app's `BASE_URL`; for production, also configure custom SMTP.
   - **Auth → Rate Limits**, for conference traffic: enable **IP Address
     Forwarding** (used with `SUPABASE_SECRET_KEY`) and raise the per-IP
     limits, since a venue's attendees share one Wi-Fi IP. Meerkat runs with
     6000 token verifications per 5 minutes, 3000 token refreshes per 5
     minutes and 3000 anonymous sign-ins per hour.

   Live updates don't use Supabase Realtime: the server streams them over SSE
   and passes them between instances with Postgres LISTEN/NOTIFY on
   `DATABASE_URL`.

## Development

```bash
cd api && pnpm dev
```

The app is served at `http://localhost:8000`. Set `PORT` to use a different
port; the frontend follows automatically. In a new git worktree, run
`./scripts/worktree-setup.sh` once to copy `api/.env`, install dependencies
and build (it also runs automatically at the start of a Claude Code session).

`pnpm dev` runs the Node server with `--watch` and serves the **built**
frontend from `api/build/`. Backend changes reload automatically; after
changing anything under `api/app/`, run `pnpm build` in a second terminal and
the server restarts on the new bundle.

Useful commands in `api/`:

| Command          | Purpose                                                    |
| ---------------- | ---------------------------------------------------------- |
| `pnpm build`     | Build the frontend and SSR bundle                          |
| `pnpm typecheck` | Generate route types, build, and run `tsc`                 |
| `pnpm lint`      | ESLint                                                     |
| `pnpm generate`  | Create a migration from changes in `api/schema.ts`         |
| `pnpm migrate`   | Apply pending migrations                                   |

The React package is built with `pnpm build` in `packages/react/` (or
`pnpm -r build` from the root). The app consumes it from `packages/react/dist`,
so rebuild it after changing the package.

## Docker

```bash
docker build -t meerkat .
docker run --rm --env-file api/.env -p 8000:8000 meerkat
```

`VITE_API_URL` is compiled into the frontend at build time; leave it unset (as
above) and the frontend calls the origin it was served from, which is what
this single container needs. Pass `--build-arg VITE_API_URL=<origin>` only
when the frontend and API are served from different origins.

## Deployment

Deploys go to [Fly.io](https://fly.io) through GitHub Actions
(`.github/workflows/continous-deployment.yml`): a push to `master` deploys the
`dev` environment, creating a GitHub release deploys `prod`. `fly.template.toml`
is rendered with the repository secrets at deploy time; they hold plain
settings only. Credentials (`DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_SECRET_KEY`, `DEVCON_VERIFICATION_SECRET`, `OPENROUTER_API_KEY`, …)
are Fly secrets (`fly secrets set -a <app>`), so they never appear in the
app's config.

A release also publishes [`@meerkat-events/react`](packages/react/README.md)
to npm, after the prod deploy, when the `version` in
`packages/react/package.json` isn't published yet. To release a new version of
the package, bump that version and create a release.

## Environment variables

Set in `api/.env`. [`api/.env.example`](api/.env.example) lists every
variable, required and optional, with what it does. Two of them are compiled
into the frontend at build time, so changing them needs a rebuild:
`VITE_API_URL` and `LEGAL_OPERATOR`; everything else is read at runtime.

## FAQ

### How do I create and apply a migration?

After modifying the schema in `api/schema.ts`:

```bash
cd api
pnpm generate   # creates a migration file in api/drizzle/
pnpm migrate    # applies pending migrations
```

Review the generated SQL before applying it: the `auth.users` table is managed
by Supabase, so remove any statements the generator emits for it.

### How do I add conferences and events?

Through the admin API, authenticated with an `x-api-key` header:

- `POST /api/v1/admin/conferences` creates a conference.
- `POST /api/v1/admin/events` upserts a batch of events, keyed by `uid`.

API keys are stored as argon2 hashes in the `api_keys` table; insert a hashed
key there to create one, with a `valid_until` if it should expire.

### How do I make someone an organizer?

Insert a row into `invitations` (`email`, `conference_id`, `role`) before the
person signs up. A database trigger grants the role when their account is
created. For an existing user, insert directly into `conference_role`.

### How do I enable automatic moderation for a conference?

With `OPENROUTER_API_KEY` set, every new question of a conference with a
`moderation` config is classified before it is stored. Questions that look
like harassment, threats, doxxing, explicit content, self-harm, hate,
discrimination, phishing, scams or shilling, politics unrelated to crypto
(outside talks about politics) or current wars and genocide are hidden from
everyone but their author (compliments are fine); if the classifier fails, questions are shown
as before. Write a short context about the conference and check it with the
eval: copy `api/scripts/moderation-cases.json` into the gitignored
`.backups/moderation/`, set its top-level `moderation` to that config, and run
`node --env-file=.env scripts/moderation-eval.ts <copy>` in `api/` (it must
exit 0). Then set it:

```sql
UPDATE conferences
SET moderation = '{"context": "Devcon, the Ethereum Foundation''s developer conference. Talks are in English."}'
WHERE id = <id>;
```

`NULL` switches moderation off again for that conference; unsetting the
`OPENROUTER_API_KEY` Fly secret switches it off everywhere (the machines
restart). Organizers restore a wrongly hidden question on the management pages
(`/manage`). The key needs OpenRouter credit: when it runs out, the API answers
402 and every question is shown unmoderated, logging a
`Question moderation failed, shown` warning, so give the key a credit limit
with margin and watch the logs during a conference. The design decisions and
eval results are in
[designs/002-question-moderation.md](designs/002-question-moderation.md).

### How do I link to the currently live session?

`/stage/<stage>` is the stage screen: the presenter view of the stage's
current event. When the stage moves on to another event, the page reloads
itself on the same URL, so the next event starts fresh (add
`?hide-qr-code=true` to hide the QR code). `/stage/<stage>/qa`
redirects to the Q&A page of that event, and `/api/v1/conferences/<id>/live`
does the same for a whole conference (its printed QR code). Use these for
signage and slides.

The current event is the live one; else one running now (the earliest
started); else the next to start; else the one that ended last. So the links
work before, between and after the sessions, and a stage only answers 404
when it has no events at all (a stage screen opened then needs a reload). The
JSON lookup (`/api/v1/events/stage/<stage>/live`) returns that event too; its
`live` field tells whether it is really live.
