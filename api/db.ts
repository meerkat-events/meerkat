import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { isSupabasePooler } from "./database-url.ts";
import env from "./env.ts";
import logger from "./logger.ts";

// A direct connection, so prepared statements work (no transaction pooler).
const client = postgres(env.connectionString, {
  connect_timeout: 30,
  // Default is 10 connections. Every machine opens this many plus one for
  // the realtime bus, all against Postgres' max_connections (see
  // https://supabase.com/docs/guides/platform/compute-and-disk#postgres-replication-slots-wal-senders-and-connections).
  max: Number(env.maxPoolSize ?? "10"),
});

const db = drizzle(client);

logger.info({ maxPoolSize: env.maxPoolSize }, "Initialized DB");

if (isSupabasePooler(env.connectionString)) {
  logger.warn(
    "DATABASE_URL points at Supabase's pooler, not the direct connection " +
      "(db.<project-ref>.supabase.co:5432): requests fail once all machines " +
      "together open more connections than its pool size",
  );
}

export default db;
