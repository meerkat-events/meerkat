import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import {
  MAX_CHARS_PER_QUESTION,
  MAX_QUESTIONS_PER_EVENT,
  MAX_QUESTIONS_PER_INTERVAL,
  MAX_VOTES_PER_EVENT,
} from "../moderation.ts";
import {
  askQuestion,
  emailUser,
  insertEvent,
  insertQuestions,
  resetDb,
  seedConference,
  type TestUser,
  upvote,
} from "./helpers.ts";

const HOUR = 60 * 60 * 1000;

/** Asserts a 429 and whether it says when to retry. */
function assertTooMany(response: Response, { retryAfter }: { retryAfter: boolean }) {
  assert.equal(response.status, 429);
  const header = response.headers.get("Retry-After");
  if (retryAfter) {
    assert.ok(header && Number(header) > 0, `Retry-After was ${header}`);
  } else {
    assert.equal(header, null);
  }
}

describe("rate limits", () => {
  let conferenceId: number;
  let eventId: number;
  let eventUid: string;
  let user: TestUser;

  beforeEach(async () => {
    await resetDb();
    const { conference, event } = await seedConference({ name: "Limits" });
    conferenceId = conference.id;
    eventId = event.id;
    eventUid = event.uid;
    user = await emailUser("attendee@example.com");
  });

  test("asking is limited per minute, with a time to retry", async () => {
    for (let index = 0; index < MAX_QUESTIONS_PER_INTERVAL; index++) {
      assert.equal((await askQuestion(eventUid, user)).status, 200, `question ${index + 1}`);
    }

    assertTooMany(await askQuestion(eventUid, user), { retryAfter: true });
  });

  test("the minute limit counts questions in every session", async () => {
    const otherEvent = await insertEvent({
      conferenceId,
      uid: "limits-other-talk",
      stage: "side",
      startOffsetMs: -HOUR,
      endOffsetMs: HOUR,
    });
    for (let index = 0; index < MAX_QUESTIONS_PER_INTERVAL; index++) {
      assert.equal((await askQuestion(eventUid, user)).status, 200);
    }

    assertTooMany(await askQuestion(otherEvent.uid, user), { retryAfter: true });
  });

  test("a session takes a limited number of questions per person, for good", async () => {
    await insertQuestions({
      eventId,
      userId: user.id,
      count: MAX_QUESTIONS_PER_EVENT - 1,
    });
    assert.equal((await askQuestion(eventUid, user)).status, 200);

    assertTooMany(await askQuestion(eventUid, user), { retryAfter: false });
  });

  test("a question is at most the maximum length", async () => {
    const longest = "a".repeat(MAX_CHARS_PER_QUESTION);
    assert.equal((await askQuestion(eventUid, user, longest)).status, 200);
    assert.equal((await askQuestion(eventUid, user, `${longest}a`)).status, 400);
    assert.equal((await askQuestion(eventUid, user, "")).status, 400);
  });

  test("voting is limited per minute and session, removing a vote included", async () => {
    const author = await emailUser("author@example.com");
    const questionUids = (await insertQuestions({
      eventId,
      userId: author.id,
      count: MAX_VOTES_PER_EVENT + 1,
    })).map((question) => question.uid);

    for (const questionUid of questionUids.slice(0, MAX_VOTES_PER_EVENT)) {
      assert.equal((await upvote(questionUid, user)).status, 200);
    }

    const lastQuestion = questionUids[MAX_VOTES_PER_EVENT]!;
    assertTooMany(await upvote(lastQuestion, user), { retryAfter: true });
    assertTooMany(await upvote(questionUids[0]!, user), { retryAfter: true });
  });

  test("the vote limit counts each session on its own", async () => {
    const author = await emailUser("author@example.com");
    const otherEvent = await insertEvent({
      conferenceId,
      uid: "limits-other-talk",
      stage: "side",
      startOffsetMs: -HOUR,
      endOffsetMs: HOUR,
    });
    const questionUids = (await insertQuestions({
      eventId,
      userId: author.id,
      count: MAX_VOTES_PER_EVENT,
    })).map((question) => question.uid);
    const [otherQuestion] = await insertQuestions({
      eventId: otherEvent.id,
      userId: author.id,
      count: 1,
    });

    for (const questionUid of questionUids) {
      assert.equal((await upvote(questionUid, user)).status, 200);
    }

    assert.equal((await upvote(otherQuestion!.uid, user)).status, 200);
  });
});
