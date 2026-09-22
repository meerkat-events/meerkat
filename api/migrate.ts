import { join } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import logger from "./logger.ts";

// Applies pending migrations from drizzle/ — Fly's `release_command`
// (fly.template.toml) runs this once per deploy, before any machine gets the
// new version; a non-zero exit aborts the deploy. Standalone on purpose: it
// needs only a database URL, not the app's other env (env.ts).
//
// Prefers DATABASE_URL (session pooler or direct) over DATABASE_POOLER_URL,
// the reverse of env.ts: DDL is safer outside the transaction pooler.
const connectionString = process.env["DATABASE_URL"] ??
  process.env["DATABASE_POOLER_URL"];

if (!connectionString) {
  throw new Error("DATABASE_URL or DATABASE_POOLER_URL must be set");
}

const client = postgres(connectionString, {
  max: 1,
  prepare: false,
  connect_timeout: 30,
  onnotice: () => {},
});

try {
  logger.info("Applying database migrations");
  await migrate(drizzle(client), {
    migrationsFolder: join(import.meta.dirname, "drizzle"),
  });
  logger.info("Database migrations applied");
} finally {
  await client.end();
}
