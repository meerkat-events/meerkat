const adminToken = Deno.env.get("ADMIN_TOKEN");

if (!adminToken) {
  throw new Error("ADMIN_TOKEN is required");
}

const syncToken = Deno.env.get("SYNC_TOKEN");

if (!syncToken) {
  throw new Error("SYNC_TOKEN is required");
}

const connectionString = Deno.env.get("DATABASE_POOLER_URL") ??
  Deno.env.get("DATABASE_URL");

if (!connectionString) {
  throw new Error("DATABASE_POOLER_URL or DATABASE_URL must be set");
}

const privateKey = Deno.env.get("PRIVATE_KEY");

if (!privateKey) {
  throw new Error("PRIVATE_KEY is required");
}

const secret = Deno.env.get("JWT_SECRET");

if (!secret) {
  throw new Error("SECRET is required");
}

const verifierEndpoint = Deno.env.get("VERIFIER_ENDPOINT");

if (!verifierEndpoint) {
  throw new Error("VERIFIER_ENDPOINT is required");
}

const codeSecret = Deno.env.get("CODE_SECRET");

if (!codeSecret) {
  throw new Error("CODE_SECRET is required");
}

const emailSecret = Deno.env.get("EMAIL_SECRET");

if (!emailSecret) {
  throw new Error("EMAIL_SECRET is required");
}

const zupassUrl = Deno.env.get("ZUPASS_URL") ?? "https://zupass.org";
const zappName = Deno.env.get("ZUPASS_ZAPP_NAME") ?? "meerkat-local";
const base = Deno.env.get("BASE_URL") ?? "https://meerkat.local";
const posthogToken = Deno.env.get("POSTHOG_TOKEN");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
const sentryDSN = Deno.env.get("SENTRY_DSN");
const maxPoolSize = Deno.env.get("DATABASE_MAX_POOL_SIZE");
const environment = Deno.env.get("ENVIRONMENT") ?? "development";
const grafanaUrl = Deno.env.get("GRAFANA_URL");

console.info(
  `Env - zupassUrl: ${zupassUrl}, base: ${base}, verifier: ${verifierEndpoint}`,
);

export default {
  adminToken,
  connectionString,
  base,
  secret,
  privateKey,
  zupassUrl,
  zappName,
  posthogToken,
  supabaseUrl,
  supabaseAnonKey,
  sentryDSN,
  verifierEndpoint,
  codeSecret,
  emailSecret,
  maxPoolSize,
  syncToken,
  environment,
  grafanaUrl,
};
