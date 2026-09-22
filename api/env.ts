const connectionString = process.env["DATABASE_POOLER_URL"] ??
  process.env["DATABASE_URL"];

if (!connectionString) {
  throw new Error("DATABASE_POOLER_URL or DATABASE_URL must be set");
}

const privateKey = process.env["PRIVATE_KEY"];

if (!privateKey) {
  throw new Error("PRIVATE_KEY is required");
}

// Port the HTTP server listens on. Fly sets it explicitly; the desktop app's
// launch.json uses `autoPort`, so a worktree whose preferred port is taken gets
// a free one through this variable (process env wins over `--env-file`).
const portRaw = process.env["PORT"] ?? "8000";
const port = Number(portRaw);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error(`PORT must be an integer in 0..65535, got "${portRaw}"`);
}

const zupassUrl = process.env["ZUPASS_URL"] ?? "https://zupass.org";
const zappName = process.env["ZUPASS_ZAPP_NAME"] ?? "meerkat-local";
// Public origin of this deployment (used for the POD type's reverse domain).
const base = process.env["BASE_URL"] ?? `http://localhost:${port}`;
const supabaseUrl = process.env["SUPABASE_URL"];
const supabaseAnonKey = process.env["SUPABASE_ANON_KEY"];

const devconVerificationSecret = process.env["DEVCON_VERIFICATION_SECRET"];
if (!devconVerificationSecret) {
  throw new Error("DEVCON_VERIFICATION_SECRET is required");
}

const supabaseServiceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!supabaseServiceRoleKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
}
const sentryDSN = process.env["SENTRY_DSN"];
const maxPoolSize = process.env["DATABASE_MAX_POOL_SIZE"];
const environment = process.env["ENVIRONMENT"] ?? "development";

// Origins allowed to call /api/* from a browser (comma-separated), e.g. the
// Devcon event app embedding `@meerkat-events/react`. Defaults to "*": the API
// authenticates with bearer tokens / API keys rather than cookies, so allowing
// any origin does not enable CSRF, and the public read endpoints are meant to
// be embeddable anywhere.
const corsOriginsRaw = process.env["CORS_ORIGINS"]?.trim();
const corsOrigins: "*" | string[] = !corsOriginsRaw || corsOriginsRaw === "*"
  ? "*"
  : corsOriginsRaw.split(",").map((origin) => origin.trim()).filter(Boolean);

// Origin of the Pretalx instance whose event schedules are synced into
// conferences with a `pretalx_event` slug (see pretalx.ts). Unset or empty
// disables the sync endpoint.
const pretalxUrl = process.env["PRETALX_URL"]?.trim().replace(/\/+$/, "") ||
  undefined;

const env = {
  connectionString,
  port,
  base,
  privateKey,
  zupassUrl,
  zappName,
  supabaseUrl,
  supabaseAnonKey,
  supabaseServiceRoleKey,
  sentryDSN,
  maxPoolSize,
  environment,
  devconVerificationSecret,
  corsOrigins,
  pretalxUrl,
};

/** `env` with secrets masked, for startup logging (see `main.ts`). */
export const redactedEnv = {
  ...env,
  connectionString: "REDACTED",
  privateKey: "REDACTED",
  devconVerificationSecret: "REDACTED",
  supabaseServiceRoleKey: "REDACTED",
};

export default env;
