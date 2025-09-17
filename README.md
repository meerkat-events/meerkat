## Meerkat

A privacy-preserving audience engagement tool for in-person and virtual
conferences. Meerkat uses Zupass for authentication and collection of associated
data.

### Prerequisites

- [Deno v2](https://deno.land/)
- [Node.js v24](https://nodejs.org/)
- [Docker](https://www.docker.com/)
- [Tmux](https://github.com/tmux/tmux/wiki)

## Get Started

To get started, run `./scripts/setup.sh` from the root directory. It will:

1. Start docker services.
2. Copy `.env.example` to `.env`, update the values as needed.
3. Install dependencies.
4. Run database migration.
5. Seed the database.
6. Create SSL certificate for https://meerkat.local

If you wish to tear down the development environment, run
`./scripts/teardown.sh` from the root directory.

## Development

To start the development environment, run `./scripts/dev.sh` from the root
directory. It will start the development environment with tmux and open a new
terminal window, then open `https://meerkat.local` in your browser.

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
