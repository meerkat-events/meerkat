import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import db from "../db.ts";
import { questions, votes } from "../schema.ts";
import {
  getPresenterEvent,
  getStagePresenterEvent,
} from "../app/lib/presenter-event.server.ts";
import {
  anonymousUser,
  insertConference,
  insertEvent,
  request,
  resetDb,
} from "./helpers.ts";

// The presenter view (/e/:uid and the stage screen /stage/:stage) renders
// the event its loader returns on the server, and the browser starts from
// it. It is public: it must show exactly what the API shows guests.

const HOUR = 60 * 60 * 1000;

beforeEach(async () => {
  await resetDb();
});

/** A question of `eventId` by `userId`, with the given timestamps set. */
async function insertQuestion(
  eventId: number,
  userId: string,
  uid: string,
  timestamps: { answeredAt?: Date; deletedAt?: Date; hiddenAt?: Date } = {},
) {
  const [question] = await db.insert(questions)
    .values({ uid, eventId, userId, question: `Question ${uid}`, ...timestamps })
    .returning();
  if (!question) {
    throw new Error("Question insert returned nothing");
  }
  return question;
}

/**
 * An event with five questions, only two of them open and visible: "most"
 * (a vote and a supervote: 4) and "fewer" (one vote). The others are
 * answered, deleted, or hidden by moderation.
 */
async function eventWithQuestions(stage: string, { live = false } = {}) {
  const { id: conferenceId } = await insertConference(`Conference ${stage}`);
  const event = await insertEvent({
    conferenceId,
    uid: `${stage}-talk`,
    stage,
    startOffsetMs: -HOUR / 2,
    endOffsetMs: HOUR / 2,
    live,
  });
  const author = await anonymousUser();
  const voter = await anonymousUser();
  const supervoter = await anonymousUser();

  const fewer = await insertQuestion(event.id, author.id, `${stage}-fewer`);
  const most = await insertQuestion(event.id, author.id, `${stage}-most`);
  await insertQuestion(event.id, author.id, `${stage}-answered`, {
    answeredAt: new Date(),
  });
  await insertQuestion(event.id, author.id, `${stage}-deleted`, {
    deletedAt: new Date(),
  });
  await insertQuestion(event.id, author.id, `${stage}-hidden`, {
    hiddenAt: new Date(),
  });

  await db.insert(votes).values([
    { questionId: fewer.id, userId: voter.id },
    { questionId: most.id, userId: voter.id },
    { questionId: most.id, userId: supervoter.id, weight: 3 },
  ]);

  return event;
}

describe("the presenter view's server data", () => {
  test("is what the API sends guests for the event", async () => {
    const event = await eventWithQuestions("p1");

    const response = await request("GET", `/api/v1/events/${event.uid}`);
    assert.equal(response.status, 200);
    const body = await response.json() as { data: unknown };

    assert.deepEqual(await getPresenterEvent(event.uid), body.data);
  });

  test("has the open, visible questions, most votes first, without private fields", async () => {
    const event = await eventWithQuestions("p2");

    const presented = await getPresenterEvent(event.uid);

    assert.equal(presented.uid, event.uid);
    assert.equal(presented.title, event.title);
    assert.deepEqual(
      presented.questions.map(({ uid, votes }) => ({ uid, votes })),
      [{ uid: "p2-most", votes: 4 }, { uid: "p2-fewer", votes: 1 }],
    );
    for (const field of ["votes", "participants"]) {
      assert.ok(!(field in presented), `event carries ${field}`);
    }
    for (const question of presented.questions) {
      for (const field of ["userId", "hiddenAt", "moderation", "vote"]) {
        assert.ok(!(field in question), `question carries ${field}`);
      }
      assert.deepEqual(Object.keys(question.user ?? {}).sort(), ["id", "name"]);
    }
  });

  test("on the stage screen is the stage's current event with its questions", async () => {
    const event = await eventWithQuestions("p3", { live: true });
    await insertEvent({
      conferenceId: event.conferenceId,
      uid: "p3-next",
      stage: "p3",
      startOffsetMs: HOUR,
      endOffsetMs: 2 * HOUR,
    });

    const presented = await getStagePresenterEvent("p3");

    assert.equal(presented.uid, event.uid);
    assert.deepEqual(
      presented.questions.map((question) => question.uid),
      ["p3-most", "p3-fewer"],
    );
  });

  test("is a 404 for an unknown event or stage", async () => {
    const isNotFound = (error: unknown) =>
      typeof error === "object" && error !== null && "init" in error &&
      (error.init as ResponseInit | null)?.status === 404;

    await assert.rejects(getPresenterEvent("no-such-talk"), isNotFound);
    await assert.rejects(getStagePresenterEvent("no-such-stage"), isNotFound);
  });
});
