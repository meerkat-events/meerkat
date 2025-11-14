import logger from "./logger.ts";

const connectionString = Deno.env.get("DATABASE_POOLER_URL") ??
  Deno.env.get("DATABASE_URL");

if (!connectionString) {
  throw new Error("DATABASE_POOLER_URL or DATABASE_URL must be set");
}

const privateKey = Deno.env.get("PRIVATE_KEY");

if (!privateKey) {
  throw new Error("PRIVATE_KEY is required");
}

const verifierEndpoint = Deno.env.get("VERIFIER_ENDPOINT");

if (!verifierEndpoint) {
  throw new Error("VERIFIER_ENDPOINT is required");
}

const zupassUrl = Deno.env.get("ZUPASS_URL") ?? "https://zupass.org";
const zappName = Deno.env.get("ZUPASS_ZAPP_NAME") ?? "meerkat-local";
const base = Deno.env.get("BASE_URL") ?? "";
const posthogToken = Deno.env.get("POSTHOG_TOKEN");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
const sentryDSN = Deno.env.get("SENTRY_DSN");
const maxPoolSize = Deno.env.get("DATABASE_MAX_POOL_SIZE");
const environment = Deno.env.get("ENVIRONMENT") ?? "development";

const env = {
  connectionString,
  base,
  privateKey,
  zupassUrl,
  zappName,
  posthogToken,
  supabaseUrl,
  supabaseAnonKey,
  sentryDSN,
  verifierEndpoint,
  maxPoolSize,
  environment,
};

logger.info({
  env: {
    ...env,
    connectionString: "REDACTED",
    privateKey: "REDACTED",
  },
}, "Parsed environment variables");

export default env;
