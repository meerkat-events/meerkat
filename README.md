## Meerkat

The audience engagement tool for in-person and virtual conferences, used by the
Ethereum Foundation for Devcon, Devconnect, and others.

Attendees scan a QR code to ask and upvote questions and send reactions.
Organizers pick the question being answered and mark the current session as
live. A presenter view runs on the stage screen and follows the live session.
Optionally, attendees can collect a signed attendance proof (a
[POD](https://pod.org)) into their [Zupass](https://zupass.org).

### Repository

| Path               | What it is                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| `api/`             | The application: Hono HTTP API, React Router 8 frontend (SSR), Drizzle schema and migrations      |
| `packages/react/`  | [`@meerkat-events/react`](packages/react/README.md) — hooks to embed live questions in your own site |
| `scripts/setup.sh` | One-shot local setup                                                                              |

## Prerequisites

- [Node.js 24](https://nodejs.org/) (ships corepack, which provides pnpm)
- A [Supabase](https://supabase.com) project — it provides Postgres, Auth and
  Realtime
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

3. Configure the Supabase project:

   - **Auth → Providers**: enable **Email** and **Anonymous sign-ins**. Login
     uses a one-time code, so the magic-link email template must include
     `{{ .Token }}`.
   - **Database → Publications**: add the `questions` and `reactions` tables
     to the `supabase_realtime` publication. Reactions on the presenter view
     and live updates on the moderation page subscribe to Postgres changes on
     these tables.

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
is rendered with the repository secrets at deploy time.

## Environment variables

Set in `api/.env` (see `api/.env.example`).

Required:

| Variable                    | Purpose                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| `DATABASE_URL`              | Postgres connection string. `DATABASE_POOLER_URL`, if set, takes precedence at runtime.     |
| `PRIVATE_KEY`               | Signs attendance PODs. Generate with `openssl rand -hex 32`.                                |
| `SUPABASE_URL`              | Supabase project URL.                                                                       |
| `SUPABASE_ANON_KEY`         | Supabase anon key, used by the browser for Auth and Realtime.                               |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key, used server-side for broadcasts and SSO logins.                  |
| `DEVCON_JWT_SECRET`         | Shared HS256 secret for validating Devcon SSO tokens.                                       |
| `ZUPASS_URL`                | Zupass server URL.                                                                          |
| `ZUPASS_ZAPP_NAME`          | Name of the Zupass zapp; also namespaces the POD collection.                                |

Optional:

| Variable                 | Purpose                                                                          |
| ------------------------ | -------------------------------------------------------------------------------- |
| `PORT`                   | Listen port (default `8000`).                                                    |
| `BASE_URL`               | Public origin of the app, used for redirects and QR codes. Default `http://localhost:$PORT`. |
| `VITE_API_URL`           | API origin compiled into the frontend. Default empty: the frontend calls the origin it was served from. |
| `CORS_ORIGINS`           | Comma-separated origins allowed to call `/api/*` from a browser. Default: `*`.   |
| `DATABASE_POOLER_URL`    | Connection string of a connection pooler, preferred over `DATABASE_URL`.          |
| `DATABASE_MAX_POOL_SIZE` | Max DB pool size (default: 10).                                                  |
| `SENTRY_DSN`             | Sentry error tracking DSN.                                                       |
| `ENVIRONMENT`            | Environment name reported to Sentry (default: `development`).                    |

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
key there to create one.

### How do I make someone an organizer?

Insert a row into `invitations` (`email`, `conference_id`, `role`) before the
person signs up. A database trigger grants the role when their account is
created. For an existing user, insert directly into `conference_role`.

### How do I link to the currently live session?

`/stage/<stage>/qa` redirects to the Q&A page of the live event on that stage
(or the next upcoming one), and `/stage/<stage>` opens the presenter view and
keeps following the live event. Use these for signage and slides.
