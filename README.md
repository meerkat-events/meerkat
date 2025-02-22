## Meerkat

A privacy-preserving audience engagement tool for in-person and virtual
conferences. Meerkat uses Zupass for authentication and collection of associated
data.

### Prerequisites

- [Deno v2](https://deno.land/)
- [Docker](https://www.docker.com/)

## Get Started

1. Copy `.env.example` to `.env` and update the values as needed.
2. Start the database with `docker compose up -d`.
3. Run database migration with `deno task db:migrate`.
4. Seed the database with `deno task db:seed`.
5. Setup git hooks with `deno task setup`.
6. Cach dependencies with `deno task api:cache` and patch dependencies with
   `deno task api:patch:mac` or `deno task :api:patch:linux`.
7. Start the local development server with `deno task api:dev`.
8. Open a second terminal and run `deno task ui:cache` and then start the
   frontend with `deno task ui:dev`.

Open your browser and visit
[http://localhost:8000/events/01j4yc358mf4xrd5aqj8kvj75t](http://localhost:8000/events/01j4yc358mf4xrd5aqj8kvj75t)
to view the app.

## Environment Variables

The following environment variables are required to run the application:

- DATABASE_URL: The connection string for the database.
- ADMIN_TOKEN: The secret token used to authenticate admin requests.
- PRIVATE_KEY: The private key used to sign PODs.
- BASE_URL: The base URL of the application.
- JWT_SECRET: The secret used to sign JWT tokens.
- CODE_SECRET: The secret used to sign codes for event secrets.
- ZUPASS_URL: The URL of the Zupass server.
- ZUPASS_ZAPP_NAME: The name of the Zupass zapp.
- SUPABASE_URL: The URL of the Supabase server.
- SUPABASE_ANON_KEY: The anon key for the Supabase server.
- VERIFIER_ENDPOINT: The URL of the verifier endpoint.

Optionally, you can set the following environment variables to enable additional
features:

- POSTHOG_TOKEN: The token for the PostHog server.
- SENTRY_DSN: The DSN for the Sentry server.

## FAQ

### How to generate secrets?

To generate a 32 bytes secret, you can run `openssl rand -hex 32`.
