import assert from "node:assert/strict";
import { test } from "node:test";

// handover.server.ts reads the environment when it is imported (env.ts), so
// placeholders go in first. None of them points anywhere real: the tests
// below only build events.
process.env["DATABASE_URL"] = "postgres://placeholder@127.0.0.1:1/none";
process.env["DEVCON_VERIFICATION_SECRET"] = "placeholder";
process.env["SUPABASE_SERVICE_ROLE_KEY"] = "placeholder";

const { HANDOVER_EVENT, handoverEvent } = await import("./handover.server.ts");

test("a successful handover is captured for the signed-in user", () => {
  const event = handoverEvent("ABC123", {
    outcome: "success",
    userId: "user-1",
    firstSignIn: true,
  });

  assert.equal(event.event, HANDOVER_EVENT);
  assert.equal(event.distinctId, "user-1");
  assert.equal(event.properties.outcome, "success");
  assert.equal(event.properties.eventUid, "ABC123");
  assert.equal(event.properties.firstSignIn, true);
  assert.equal("$process_person_profile" in event.properties, false);
});

test("a failed handover is captured without a person", () => {
  const first = handoverEvent("ABC123", {
    outcome: "expired",
    reason: "Token has expired",
  });
  const second = handoverEvent("ABC123", { outcome: "failed" });

  assert.equal(first.properties.outcome, "expired");
  assert.equal(first.properties.reason, "Token has expired");
  assert.equal(first.properties.$process_person_profile, false);
  assert.equal("reason" in second.properties, false);
  // A fresh distinct id each time, so failures don't merge into one person.
  assert.notEqual(first.distinctId, second.distinctId);
});
