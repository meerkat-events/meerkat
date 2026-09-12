import logger from "./logger.ts";

const connectionString = process.env["DATABASE_POOLER_URL"] ??
  process.env["DATABASE_URL"];

if (!connectionString) {
  throw new Error("DATABASE_POOLER_URL or DATABASE_URL must be set");
}

const privateKey = process.env["PRIVATE_KEY"];

if (!privateKey) {
  throw new Error("PRIVATE_KEY is required");
}

const zupassUrl = process.env["ZUPASS_URL"] ?? "https://zupass.org";
const zappName = process.env["ZUPASS_ZAPP_NAME"] ?? "meerkat-local";
const base = process.env["BASE_URL"] ?? "";
const supabaseUrl = process.env["SUPABASE_URL"];
const supabaseAnonKey = process.env["SUPABASE_ANON_KEY"];

const devconJwtSecret = process.env["DEVCON_JWT_SECRET"];
if (!devconJwtSecret) {
  throw new Error("DEVCON_JWT_SECRET is required");
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

const env = {
  connectionString,
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
  devconJwtSecret,
  corsOrigins,
};

logger.info({
  env: {
    ...env,
    connectionString: "REDACTED",
    privateKey: "REDACTED",
    devconJwtSecret: "REDACTED",
    supabaseServiceRoleKey: "REDACTED",
  },
}, "Parsed environment variables");

export default env;
