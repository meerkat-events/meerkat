import { test } from "node:test";
import assert from "node:assert/strict";
import { isSupabasePooler } from "./database-url.ts";

test("the session and transaction pooler hosts are the pooler", () => {
  assert.equal(
    isSupabasePooler(
      "postgresql://postgres.project:secret@aws-0-eu-central-1.pooler.supabase.com:5432/postgres",
    ),
    true,
  );
  assert.equal(
    isSupabasePooler(
      "postgres://postgres.project:secret@aws-1-us-east-1.pooler.supabase.com:6543/postgres",
    ),
    true,
  );
});

test("the direct connection and local databases are not the pooler", () => {
  assert.equal(
    isSupabasePooler("postgresql://postgres:secret@db.project.supabase.co:5432/postgres"),
    false,
  );
  assert.equal(
    isSupabasePooler("postgresql://postgres:postgres@127.0.0.1:54322/postgres"),
    false,
  );
});

test("a value that is not a URL is not the pooler", () => {
  assert.equal(isSupabasePooler("not a url"), false);
});
