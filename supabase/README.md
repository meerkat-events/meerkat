# Supabase project setup

The CLI-reproducible half of a Meerkat Supabase project, pulled from the dev
project with `supabase config pull`.

```
config.toml    service settings (auth, api, pooler, rate limits)
templates/     the two auth emails Meerkat customizes
```

The tables come from Drizzle (`api/schema.ts`), and the Supabase-specific DDL
Drizzle does not emit (RLS, Realtime policies, publication) from
`api/scripts/supabase-policies.sql`.

## Creating a new project

```bash
supabase orgs list          # org id for the next command

# Generate and keep the DB password. Hex, so it needs no percent-encoding
# when it goes into DATABASE_URL.
PW=$(openssl rand -hex 24); echo "$PW"

supabase projects create <project-name> \
  --org-id <org-id> \
  --region eu-central-1 \
  --db-password "$PW"

supabase projects api-keys --project-ref <new-ref> --reveal
```

The org is on the **Free plan**, so do not pass `--size`.

Put `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_SECRET_KEY` (the `default` secret key)
into `api/.env` (unquoted, see `api/.env.example`). Then apply schema and
settings **in this order**. Drizzle owns the tables, so it has to run before the
policies script can ALTER them:

```bash
cd api && pnpm migrate          # 1. tables (api/schema.ts -> api/drizzle/)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/supabase-policies.sql   # 2. RLS, realtime policies, publication
cd .. && supabase link --project-ref <new-ref>
supabase config diff            # 3. review, then:
supabase config push
```

Finally, in the dashboard set **Site URL** and **Redirect URLs** (see below),
enable **IP Address Forwarding** (Authentication → Rate Limits), and create an
admin API key if the project needs one.

## Applying to a project that already exists

`config push` writes every property the file *declares*, so pushing the whole
file at a live project can overwrite settings that were tuned there. To change
one thing, push a minimal config that declares only that thing, from a scratch
directory:

```bash
mkdir -p /tmp/one-setting/supabase && cd /tmp/one-setting
cat > supabase/config.toml <<'EOF'
project_id = "scratch"

[auth.email.template.magic_link]
subject = "..."
content_path = "./supabase/templates/magic_link.html"
EOF
supabase config diff --project-ref <ref>   # verify the scope, then push
```

Read the `class` of each entry in `config diff`, not just the count:

| class | meaning |
| --- | --- |
| `update` / `local_only` | declared locally — **will be written** |
| `remote_only` | not declared locally — left alone |

A `remote_only` row still prints a `local` value (the CLI's own default). That is
display only; it is not pushed.

## What the CLI reproduces

`supabase config diff` against the dev project reports nothing to push, so these
all carry over to a new project:

| Setting | Value | Why it matters |
| --- | --- | --- |
| `auth.enable_anonymous_sign_ins` | `true` | attendees join without an account (`use-anonymous-user.ts`) |
| `auth.email.otp_length` | `8` | the code in the sign-in emails |
| `auth.email.enable_confirmations` | `true` | email OTP sign-up (`use-otp.ts`) |
| `auth.email.max_frequency` | `1m` | resend cooldown |
| `auth.mfa.totp.{enroll,verify}_enabled` | `true` | |
| `db.pooler.default_pool_size` / `max_client_conn` | `15` / `200` | |
| `auth.email.template.{confirmation,magic_link}` | `templates/*.html` | deliver `{{ .Token }}`, not a magic link |
| `auth.rate_limit.token_verifications` | `6000` / 5 min / IP | every Devcon handover verifies a one-time token server-side |
| `auth.rate_limit.token_refresh` | `3000` / 5 min / IP | session refreshes from a venue's shared Wi-Fi IP |
| `auth.rate_limit.anonymous_users` | `3000` / hour / IP | anonymous joins from a venue's shared Wi-Fi IP |

RLS on all public tables, the `Realtime` SELECT policies on `questions` /
`reactions` / `votes` and their `supabase_realtime` publication come from
`api/scripts/supabase-policies.sql`, which is idempotent and safe to re-run.

## Undeclared on purpose

These are left commented out so `config push` never touches them. A commented
key is undeclared even when its section header is live: with CLI 2.120,
`config diff` lists it as `remote_only` and the push leaves it alone.

- **`auth.site_url`, `auth.additional_redirect_urls`** — no single value to
  reproduce. Dev allows exact URLs including `localhost`, prod a
  `https://<host>/**` wildcard. Set per project in the dashboard.
- **The other `[auth.rate_limit]` keys** — `sign_in_sign_ups` varies per
  project (prod runs it at `2000`); `email_sent` and `sms_sent` depend on the
  project's SMTP and SMS setup; Meerkat has no Web3 sign-in.
- **`[storage.analytics]`, `[storage.vector]`, `[auth.sms.twilio]`** — enabled on
  some projects, off in the CLI template, and Meerkat depends on none of them.

## What it does not reproduce

- **API keys, JWT secret and signing keys** — generated per project. Read them
  with `supabase projects api-keys` and copy into `api/.env`.
- **IP Address Forwarding** — the CLI config has no key for it. Enable it in
  the dashboard (Authentication → Rate Limits) so the Devcon handover, which
  sends the attendee's IP in `sb-forwarded-for` when `SUPABASE_SECRET_KEY` is
  set, is rate-limited per attendee rather than per server.
- **Email subjects and templates on the Free plan.** The Management API rejects
  these with `400 Email template modification is not available for free tier
  projects using the default email provider`. Configure `[auth.email.smtp]`
  (custom SMTP) or upgrade the plan first — until then a new project sends
  Supabase's stock link-based emails, which do **not** carry the
  `{{ .Token }}` code the sign-in UI asks for.
- **Custom domains and vanity subdomains** — Pro plan only.
- **Admin API keys** (`api_keys` table) — no endpoint creates them; insert an
  argon2 hash directly.
- **Seed data** — `api/scripts/seed.sh`.
