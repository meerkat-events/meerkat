import assert from "node:assert/strict";
import { test } from "node:test";
import { isTable } from "drizzle-orm";
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import * as schema from "./schema.ts";

/** The tables schema.ts creates in `public`, which the Data API exposes. */
function publicTables(): PgTable[] {
  const tables: PgTable[] = [];
  for (const value of Object.values(schema)) {
    if (!isTable(value)) continue;
    const table = value as PgTable;
    // auth.users belongs to Supabase; schema.ts only declares it for joins.
    if (getTableConfig(table).schema !== undefined) continue;
    tables.push(table);
  }
  return tables;
}

test("schema.ts declares the public tables", () => {
  assert.ok(publicTables().length > 0);
});

test("every public table enables Row Level Security", () => {
  const withoutRls = publicTables()
    .map((table) => getTableConfig(table))
    .filter((config) => !config.enableRLS)
    .map((config) => config.name);
  assert.deepEqual(
    withoutRls,
    [],
    "add .enableRLS() to these tables in schema.ts and run pnpm generate",
  );
});
