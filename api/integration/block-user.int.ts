import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import {
  anonymousUser,
  emailUser,
  grantTestRole,
  request,
  resetDb,
  seedConference,
  type TestUser,
} from "./helpers.ts";

describe("blocking a user", () => {
  let moderator: TestUser;
  let attendee: TestUser;
  let target: TestUser;

  const block = (token?: string) =>
    request(
      "POST",
      `/api/v1/users/${target.id}/block`,
      token ? { token } : {},
    );

  beforeEach(async () => {
    await resetDb();
    const { conference } = await seedConference({ name: "Block" });
    moderator = await emailUser("moderator@example.com");
    await grantTestRole(moderator.id, conference.id, "moderator");
    attendee = await emailUser("attendee@example.com");
    await grantTestRole(attendee.id, conference.id, "attendee");
    target = await anonymousUser();
  });

  test("a moderator can block", async () => {
    assert.equal((await block(moderator.token)).status, 200);
  });

  test("an attendee can't", async () => {
    assert.equal((await block(attendee.token)).status, 403);
  });

  test("nobody can without a token", async () => {
    assert.equal((await block()).status, 401);
  });
});
