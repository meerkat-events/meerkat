import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import db from "../db.ts";
import { events, questions } from "../schema.ts";
import { setHighEngagement, upsertEvents } from "../models/events.ts";
import { RECENTLY_ANSWERED_LIMIT } from "../models/public-event.ts";
import { selectQuestion } from "../models/questions.ts";
import { getPresenterEvent } from "../app/lib/presenter-event.server.ts";
import {
  anonymousUser,
  grantTestRole,
  request,
  resetDb,
  seedConference,
} from "./helpers.ts";

// High engagement mode: organizers switch it per event, and the presenter
// view then shows the question being answered with the latest answered
// ones below it (`recentlyAnswered`, newest first).

beforeEach(async () => {
  await resetDb();
});

/** An open question of `eventId`, with the given timestamps set. */
async function insertQuestion(
  eventId: number,
  uid: string,
  timestamps: { answeredAt?: Date; deletedAt?: Date; hiddenAt?: Date } = {},
) {
  const author = await anonymousUser();
  const [question] = await db.insert(questions)
    .values({
      uid,
      eventId,
      userId: author.id,
      question: `Question ${uid}`,
      ...timestamps,
    })
    .returning();
  if (!question) {
    throw new Error("Question insert returned nothing");
  }
  return question;
}

async function answeredAtOf(questionId: number) {
  const [row] = await db.select({ answeredAt: questions.answeredAt })
    .from(questions)
    .where(eq(questions.id, questionId));
  return row?.answeredAt ?? null;
}

describe("selecting a question", () => {
  test("answers only the previous selection, keeping earlier answer times", async () => {
    const { event } = await seedConference({ name: "Select order" });
    const a = await insertQuestion(event.id, "a");
    const b = await insertQuestion(event.id, "b");
    const c = await insertQuestion(event.id, "c");

    await selectQuestion(a.id);
    await selectQuestion(b.id);
    const aAnsweredAt = await answeredAtOf(a.id);
    assert.ok(aAnsweredAt, "selecting b answers a");

    await selectQuestion(c.id);

    assert.deepEqual(await answeredAtOf(a.id), aAnsweredAt);
    await setHighEngagement(event.id, true);
    const presented = await getPresenterEvent(event.uid);
    assert.deepEqual(
      presented.recentlyAnswered.map((question) => question.uid),
      ["b", "a"],
    );
  });

  test("puts an answered question back on stage", async () => {
    const { event } = await seedConference({ name: "Reselect" });
    const a = await insertQuestion(event.id, "a");
    const b = await insertQuestion(event.id, "b");

    await selectQuestion(a.id);
    await selectQuestion(b.id);
    await selectQuestion(a.id);

    assert.equal(await answeredAtOf(a.id), null);
    assert.ok(await answeredAtOf(b.id), "selecting a again answers b");
    await setHighEngagement(event.id, true);
    const presented = await getPresenterEvent(event.uid);
    assert.deepEqual(presented.questions.map((question) => question.uid), ["a"]);
    assert.deepEqual(
      presented.recentlyAnswered.map((question) => question.uid),
      ["b"],
    );
  });
});

describe("POST /api/v1/events/:uid/high-engagement", () => {
  test("lets organizers switch the mode, and nobody else", async () => {
    const { conference, event } = await seedConference({ name: "Switch" });
    const organizer = await anonymousUser();
    const moderator = await anonymousUser();
    const attendee = await anonymousUser();
    await grantTestRole(organizer.id, conference.id, "organizer");
    await grantTestRole(moderator.id, conference.id, "moderator");
    await grantTestRole(attendee.id, conference.id, "attendee");
    const path = `/api/v1/events/${event.uid}/high-engagement`;

    for (const user of [moderator, attendee]) {
      const response = await request("POST", path, {
        token: user.token,
        body: { enabled: true },
      });
      assert.equal(response.status, 403);
    }
    const invalid = await request("POST", path, {
      token: organizer.token,
      body: { enabled: "yes" },
    });
    assert.equal(invalid.status, 400);
    assert.equal((await getPresenterEvent(event.uid)).highEngagement, false);

    const on = await request("POST", path, {
      token: organizer.token,
      body: { enabled: true },
    });
    assert.equal(on.status, 200);
    assert.equal((await getPresenterEvent(event.uid)).highEngagement, true);

    const off = await request("POST", path, {
      token: organizer.token,
      body: { enabled: false },
    });
    assert.equal(off.status, 200);
    assert.equal((await getPresenterEvent(event.uid)).highEngagement, false);
  });
});

describe("the public event in high engagement mode", () => {
  test("has the latest visible answered questions, newest first", async () => {
    const { event } = await seedConference({ name: "Feed" });
    const minute = 60 * 1000;
    const start = Date.now() - 60 * minute;
    for (let index = 0; index < RECENTLY_ANSWERED_LIMIT + 2; index++) {
      await insertQuestion(event.id, `answered-${index}`, {
        answeredAt: new Date(start + index * minute),
      });
    }
    await insertQuestion(event.id, "hidden", {
      answeredAt: new Date(),
      hiddenAt: new Date(),
    });
    await insertQuestion(event.id, "deleted", {
      answeredAt: new Date(),
      deletedAt: new Date(),
    });

    const off = await getPresenterEvent(event.uid);
    assert.deepEqual(off.recentlyAnswered, []);

    await setHighEngagement(event.id, true);
    const on = await getPresenterEvent(event.uid);
    const newestFirst = Array.from(
      { length: RECENTLY_ANSWERED_LIMIT },
      (_, index) => `answered-${RECENTLY_ANSWERED_LIMIT + 1 - index}`,
    );
    assert.deepEqual(
      on.recentlyAnswered.map((question) => question.uid),
      newestFirst,
    );
  });

  test("stays on when the schedule is imported again", async () => {
    const { event } = await seedConference({ name: "Import" });
    await setHighEngagement(event.id, true);

    await upsertEvents([{
      conferenceId: event.conferenceId,
      uid: event.uid,
      title: "Renamed",
      start: event.start,
      end: event.end,
      stage: event.stage,
    }]);

    const [row] = await db.select().from(events).where(eq(events.id, event.id));
    assert.equal(row?.title, "Renamed");
    assert.equal(row?.highEngagement, true);
  });
});
