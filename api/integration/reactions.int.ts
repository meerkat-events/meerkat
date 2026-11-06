import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import db from "../db.ts";
import { MAX_REACTIONS_PER_INTERVAL } from "../moderation.ts";
import { getUserReactionTimesAfterDate } from "../models/reactions.ts";
import { reactions } from "../schema.ts";
import {
  anonymousUser,
  react,
  resetDb,
  seedConference,
} from "./helpers.ts";

const reactionRows = (uid: string) =>
  db.select().from(reactions).where(eq(reactions.uid, uid));

describe("reactions", () => {
  let eventId: number;
  let eventUid: string;

  beforeEach(async () => {
    await resetDb();
    const { event } = await seedConference({ name: "Reactions" });
    eventId = event.id;
    eventUid = event.uid;
  });

  test("a resent reaction gets the stored one and is stored and counted once", async () => {
    const user = await anonymousUser();
    const body = { uid: crypto.randomUUID(), emoji: "heart" };

    const first = await react(eventUid, user, body);
    const resent = await react(eventUid, user, body);
    assert.equal(first.status, 200);
    assert.equal(resent.status, 200);
    assert.deepEqual(await resent.json(), await first.json());

    assert.equal((await reactionRows(body.uid)).length, 1);
    const reactionTimes = await getUserReactionTimesAfterDate(
      user.id,
      new Date(0),
    );
    assert.equal(reactionTimes.length, 1, "counts once toward the rate limit");
  });

  test("the limit lets MAX reactions through and turns the next away", async () => {
    const user = await anonymousUser();
    // One fewer than the limit already stored, recent enough to count.
    const rows = Array.from(
      { length: MAX_REACTIONS_PER_INTERVAL - 1 },
      () => ({ uid: crypto.randomUUID(), userId: user.id, eventId }),
    );
    await db.insert(reactions).values(rows);

    const last = await react(eventUid, user, {
      uid: crypto.randomUUID(),
      emoji: "heart",
    });
    assert.equal(last.status, 200, `reaction #${MAX_REACTIONS_PER_INTERVAL}`);

    const over = await react(eventUid, user, {
      uid: crypto.randomUUID(),
      emoji: "heart",
    });
    assert.equal(over.status, 429, `reaction #${MAX_REACTIONS_PER_INTERVAL + 1}`);
    const retryAfter = Number(over.headers.get("Retry-After"));
    assert.ok(
      retryAfter >= 1 && retryAfter <= 30,
      `Retry-After within the 30 s window, got ${retryAfter}`,
    );
  });

  test("a resend isn't turned away by the rate limit", async () => {
    const user = await anonymousUser();
    // Exactly at the limit: a new reaction is turned away, a resend isn't.
    const rows = Array.from(
      { length: MAX_REACTIONS_PER_INTERVAL },
      () => ({ uid: crypto.randomUUID(), userId: user.id, eventId }),
    );
    await db.insert(reactions).values(rows);

    const resent = await react(eventUid, user, {
      uid: rows[0]!.uid,
      emoji: "heart",
    });
    assert.equal(resent.status, 200);
    const fresh = await react(eventUid, user, {
      uid: crypto.randomUUID(),
      emoji: "heart",
    });
    assert.equal(fresh.status, 429);
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

  test("the same uid in another event answers 409", async () => {
    const user = await anonymousUser();
    const { event: otherEvent } = await seedConference({ name: "Elsewhere" });
    const body = { uid: crypto.randomUUID(), emoji: "heart" };

    assert.equal((await react(eventUid, user, body)).status, 200);
    assert.equal((await react(otherEvent.uid, user, body)).status, 409);

    const rows = await reactionRows(body.uid);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.eventId, eventId);
  });

  test("a uid that isn't a UUID answers 400", async () => {
    const user = await anonymousUser();
    const response = await react(eventUid, user, {
      uid: "not-a-uuid",
      emoji: "heart",
    });
    assert.equal(response.status, 400);
  });
});
