## Meerkat

The audience engagement tool for in-person and virtual conferences, used by the
Ethereum Foundation for Devcon, Devconnect, and others.

### Prerequisites

- [Node.js v24](https://nodejs.org/) (includes corepack, which installs pnpm
  automatically)

## Get Started

To get started, run `./scripts/setup.sh` from the root directory. It will:

1. Copy `.env.example` to `.env`, update the values as needed
2. Install dependencies.
3. Run database migrations.
4. Seed the database.

If you wish to tear down the development environment, run
`./scripts/teardown.sh` from the root directory.

## Development

```bash
cd api && pnpm dev
```

The app will be available at `http://localhost:8000`.

## Environment Variables

The following environment variables are required (place them in `api/.env`):

- `DATABASE_URL`: PostgreSQL connection string.
- `PRIVATE_KEY`: Signs Zupass PODs (generate: `openssl rand -hex 32`).
- `BASE_URL`: Base URL of the application.
- `ZUPASS_URL`: Zupass server URL.
- `ZUPASS_ZAPP_NAME`: Zupass zapp name.
- `SUPABASE_URL`: Supabase project URL.
- `SUPABASE_ANON_KEY`: Supabase anon key.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (admin API).
- `DEVCON_JWT_SECRET`: Shared HS256 secret for validating Devcon SSO tokens.

Optional:

- `POSTHOG_TOKEN`: PostHog analytics token.
- `SENTRY_DSN`: Sentry error tracking DSN.
- `DATABASE_POOLER_URL`: Alternative connection string for a connection pooler.
- `DATABASE_MAX_POOL_SIZE`: Max DB pool size (default: 10).

## FAQ

### How to create and apply a migration?

After modifying the database schema in `api/schema.ts`:

```bash
cd api
pnpm generate   # create migration file in api/drizzle/
pnpm migrate    # apply pending migrations
```
