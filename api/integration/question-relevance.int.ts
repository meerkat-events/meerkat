import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import db from "../db.ts";
import { questions } from "../schema.ts";
import {
  anonymousUser,
  emailUser,
  grantTestRole,
  postedQuestionUid,
  request,
  resetDb,
  seedConference,
  type TestUser,
} from "./helpers.ts";

// The Q&A page shows organizers and moderators each question's relevance
// score next to their controls. Only they get it, and only in the event's
// question list; every other response leaves it out.

type ListedQuestion = { uid: string; relevance?: number | null };

describe("question relevance", () => {
  let eventUid: string;
  let organizer: TestUser;
  let moderator: TestUser;
  let attendee: TestUser;
  let otherModerator: TestUser;
  let scoredUid: string;
  let refusedUid: string;

  const list = async (viewer?: TestUser) => {
    const response = await request(
      "GET",
      `/api/v1/events/${eventUid}/questions`,
      viewer ? { token: viewer.token } : {},
    );
    assert.equal(response.status, 200);
    const { data } = await response.json() as { data: ListedQuestion[] };
    return data;
  };

  const ask = (author: TestUser, question: string) =>
    postedQuestionUid(eventUid, author, question);

  beforeEach(async () => {
    await resetDb();
    const { conference, event } = await seedConference({ name: "Relevance" });
    const { conference: otherConference } = await seedConference({
      name: "Elsewhere",
    });
    eventUid = event.uid;
    organizer = await emailUser("organizer@example.com");
    await grantTestRole(organizer.id, conference.id, "organizer");
    moderator = await emailUser("moderator@example.com");
    await grantTestRole(moderator.id, conference.id, "moderator");
    attendee = await emailUser("attendee@example.com");
    await grantTestRole(attendee.id, conference.id, "attendee");
    otherModerator = await emailUser("other-moderator@example.com");
    await grantTestRole(otherModerator.id, otherConference.id, "moderator");

    const author = await anonymousUser();
    scoredUid = await ask(author, "How does this scale?");
    refusedUid = await ask(author, "What comes next?");

    // Moderation is off for the seeded conference, so set the verdicts
    // directly: one classified with a score, one the model refused (shown
    // again, as an organizer restoring it would).
    await db.update(questions).set({
      moderation: {
        category: "shilling",
        decision: "show",
        flagged: 0.01,
        politics: 0,
        war: 0,
        safety: 0,
        selfHarm: 0,
        relevance: 2.6,
        model: "test-model",
      },
    }).where(eq(questions.uid, scoredUid));
    await db.update(questions).set({
      moderation: { refused: true, decision: "hide", model: "test-model" },
      hiddenAt: null,
    }).where(eq(questions.uid, refusedUid));
  });

  test("organizers and moderators get each question's score", async () => {
    for (const viewer of [organizer, moderator]) {
      const relevance = new Map(
        (await list(viewer)).map((q) => [q.uid, q.relevance]),
      );
      assert.equal(relevance.get(scoredUid), 2.6);
      assert.equal(relevance.get(refusedUid), null);
    }
  });

  test("nobody else gets a relevance key", async () => {
    const viewers = [attendee, await anonymousUser(), otherModerator, undefined];
    for (const viewer of viewers) {
      const listed = await list(viewer);
      assert.equal(listed.length, 2);
      for (const question of listed) {
        assert.ok(!("relevance" in question), `relevance for ${viewer?.id}`);
      }
    }
  });

  test("the event leaves the score out of its selected question", async () => {
    const selected = await request(
      "POST",
      `/api/v1/questions/${scoredUid}/select`,
      { token: organizer.token },
    );
    assert.equal(selected.status, 200);

    const eventResponse = await request("GET", `/api/v1/events/${eventUid}`, {
      token: moderator.token,
    });
    assert.equal(eventResponse.status, 200);
    const { data: publicEvent } = await eventResponse.json() as {
      data: { questions: (ListedQuestion & { selectedAt: string | null })[] };
    };
    const selectedQuestion = publicEvent.questions.find((q) =>
      q.uid === scoredUid
    );
    assert.ok(selectedQuestion?.selectedAt, "the scored question is selected");
    for (const question of publicEvent.questions) {
      assert.ok(!("relevance" in question));
    }
  });
});
