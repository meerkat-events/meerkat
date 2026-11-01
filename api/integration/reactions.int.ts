import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import db from "../db.ts";
import { getUserReactionTimesAfterDate } from "../models/reactions.ts";
import { reactions } from "../schema.ts";
import {
  anonymousUser,
  request,
  resetDb,
  seedConference,
  type TestUser,
} from "./helpers.ts";

const react = (
  eventUid: string,
  user: TestUser,
  body: { uid: string; emoji: string },
) => request("POST", `/api/v1/events/${eventUid}/react`, {
  token: user.token,
  body,
});

const reactionRows = (uid: string) =>
  db.select().from(reactions).where(eq(reactions.uid, uid));

describe("reactions", () => {
  let eventUid: string;

  beforeEach(async () => {
    await resetDb();
    const { event } = await seedConference({ name: "Reactions" });
    eventUid = event.uid;
  });

  test("a resent reaction answers 409 and is stored and counted once", async () => {
    const user = await anonymousUser();
    const body = { uid: crypto.randomUUID(), emoji: "heart" };

    assert.equal((await react(eventUid, user, body)).status, 200);
    assert.equal((await react(eventUid, user, body)).status, 409);

    assert.equal((await reactionRows(body.uid)).length, 1);
    const reactionTimes = await getUserReactionTimesAfterDate(
      user.id,
      new Date(0),
    );
    assert.equal(reactionTimes.length, 1, "counts once toward the rate limit");
  });

  test("another user's reaction uid answers 409 and stays theirs", async () => {
    const owner = await anonymousUser();
    const other = await anonymousUser();
    const uid = crypto.randomUUID();

    assert.equal(
      (await react(eventUid, owner, { uid, emoji: "heart" })).status,
      200,
    );
    assert.equal(
      (await react(eventUid, other, { uid, emoji: "fire" })).status,
      409,
    );

    const rows = await reactionRows(uid);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.userId, owner.id);
    assert.equal(rows[0]?.emoji, "heart");
  });
});
