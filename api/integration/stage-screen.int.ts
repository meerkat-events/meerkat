import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { eq } from "drizzle-orm";
import db from "../db.ts";
import { events } from "../schema.ts";
import { request, resetDb, seedConference } from "./helpers.ts";

beforeEach(async () => {
  await resetDb();
});

test("the stage link keeps the screen's options on the redirect", async () => {
  const { event } = await seedConference({ name: "Stage Screen" });
  await db.update(events).set({ live: true }).where(eq(events.id, event.id));

  const response = await request("GET", "/stage/main?hide-qr-code=true");

  assert.equal(response.status, 302);
  const location = new URL(response.headers.get("Location")!);
  assert.equal(location.pathname, `/e/${event.uid}`);
  assert.equal(location.searchParams.get("hide-qr-code"), "true");
  assert.equal(location.searchParams.get("keep-live"), "true");
});
