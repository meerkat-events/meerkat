import assert from "node:assert/strict";
import { test } from "node:test";
import { ATTENDEES_ONLY_FEATURE } from "../../features.ts";
import { canParticipate } from "./participation.ts";

const openEvent = { conference: { features: {} } };
const attendeesOnlyEvent = {
  conference: { features: { [ATTENDEES_ONLY_FEATURE]: true } },
};

test("canParticipate is false until the event has loaded", () => {
  assert.equal(
    canParticipate({
      event: undefined,
      isAuthenticated: true,
      hasRoleHere: true,
    }),
    false,
  );
});

test("canParticipate needs a signed-in user", () => {
  assert.equal(
    canParticipate({
      event: openEvent,
      isAuthenticated: false,
      hasRoleHere: false,
    }),
    false,
  );
  assert.equal(
    canParticipate({
      event: openEvent,
      isAuthenticated: true,
      hasRoleHere: false,
    }),
    true,
  );
});

test("canParticipate in an attendees-only conference needs a role there", () => {
  assert.equal(
    canParticipate({
      event: attendeesOnlyEvent,
      isAuthenticated: true,
      hasRoleHere: false,
    }),
    false,
  );
  assert.equal(
    canParticipate({
      event: attendeesOnlyEvent,
      isAuthenticated: true,
      hasRoleHere: true,
    }),
    true,
  );
});
