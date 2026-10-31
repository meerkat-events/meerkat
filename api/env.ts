// A direct or session pooler connection, never the transaction pooler: the
// realtime bus LISTENs on it (realtime/postgres-bus.ts), which needs a
// session. Queries prefer the pooler when one is set.
const realtimeConnectionString = process.env["DATABASE_URL"];
if (!realtimeConnectionString) {
  throw new Error("DATABASE_URL is required");
}
const connectionString = process.env["DATABASE_POOLER_URL"] ??
  realtimeConnectionString;

// Port the HTTP server listens on. Fly sets it explicitly; the desktop app's
// launch.json uses `autoPort`, so a worktree whose preferred port is taken gets
// a free one through this variable (process env wins over `--env-file`).
const portRaw = process.env["PORT"] ?? "8000";
const port = Number(portRaw);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error(`PORT must be an integer in 0..65535, got "${portRaw}"`);
}

// Public origin of this deployment, for absolute links (QR codes, redirects).
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
// Secret API key (`sb_secret_…`). Optional: when set, the Devcon handover
// forwards the attendee's IP to Supabase Auth so its per-IP rate limits apply
// to the attendee rather than to our servers (app/lib/handover.server.ts).
const supabaseSecretKey = process.env["SUPABASE_SECRET_KEY"] || undefined;
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

// OpenRouter key for automatic question moderation (classifier.ts). Unset
// disables moderation for every conference; questions are then shown as
// before.
const openRouterApiKey = process.env["OPENROUTER_API_KEY"]?.trim() ||
  undefined;

const env = {
  connectionString,
  realtimeConnectionString,
  port,
  base,
  supabaseUrl,
  supabaseAnonKey,
  supabaseServiceRoleKey,
  supabaseSecretKey,
  sentryDSN,
  maxPoolSize,
  environment,
  devconVerificationSecret,
  corsOrigins,
  pretalxUrl,
  openRouterApiKey,
};

/** `env` with secrets masked, for startup logging (see `main.ts`). */
export const redactedEnv = {
  ...env,
  connectionString: "REDACTED",
  realtimeConnectionString: "REDACTED",
  devconVerificationSecret: "REDACTED",
  supabaseServiceRoleKey: "REDACTED",
  // Public by design (the browser gets them), but still credentials.
  supabaseAnonKey: env.supabaseAnonKey ? "REDACTED" : undefined,
  sentryDSN: env.sentryDSN ? "REDACTED" : undefined,
  // Unset stays visible: it tells whether the handover forwards client IPs.
  supabaseSecretKey: env.supabaseSecretKey ? "REDACTED" : undefined,
  // Unset stays visible: it tells whether questions are moderated.
  openRouterApiKey: env.openRouterApiKey ? "REDACTED" : undefined,
};

export default env;
