import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { ATTENDEES_ONLY_FEATURE } from "../features.ts";
import { consumeHandoverToken } from "../app/lib/handover.server.ts";
import {
  anonymousUser,
  emailUser,
  grantTestRole,
  handoverToken,
  invite,
  request,
  resetDb,
  rolesOf,
  seedConference,
  type TestUser,
} from "./helpers.ts";

const askQuestion = (eventUid: string, user: TestUser) =>
  request("POST", `/api/v1/events/${eventUid}/questions`, {
    token: user.token,
    body: { question: "How does this scale?" },
  });

const react = (eventUid: string, user: TestUser) =>
  request("POST", `/api/v1/events/${eventUid}/react`, {
    token: user.token,
    body: { uid: crypto.randomUUID(), emoji: "heart" },
  });

const upvote = (questionUid: string, user: TestUser) =>
  request("POST", `/api/v1/questions/${questionUid}/upvote`, {
    token: user.token,
  });

/** Asks a question as `user`, failing the test unless that succeeds. */
async function postedQuestionUid(eventUid: string, user: TestUser) {
  const response = await askQuestion(eventUid, user);
  assert.equal(response.status, 200);
  const body = await response.json() as { data: { uid: string } };
  return body.data.uid;
}

/** Asking, reacting and voting all answer `status` for `user`. */
async function assertParticipation(
  eventUid: string,
  questionUid: string,
  user: TestUser,
  status: number,
) {
  assert.equal((await askQuestion(eventUid, user)).status, status, "ask");
  assert.equal((await react(eventUid, user)).status, status, "react");
  assert.equal((await upvote(questionUid, user)).status, status, "vote");
}

describe("attendees-only conference", () => {
  let eventUid: string;
  let conferenceId: number;
  let questionUid: string;

  beforeEach(async () => {
    await resetDb();
    const { conference, event } = await seedConference({
      name: "Gated",
      featureNames: [ATTENDEES_ONLY_FEATURE],
    });
    eventUid = event.uid;
    conferenceId = conference.id;

    const organizer = await emailUser("organizer@example.com");
    await grantTestRole(organizer.id, conferenceId, "organizer");
    questionUid = await postedQuestionUid(eventUid, organizer);
  });

  test("turns away anonymous users", async () => {
    const user = await anonymousUser();
    await assertParticipation(eventUid, questionUid, user, 403);
  });

  test("turns away signed-in users without a role", async () => {
    const user = await emailUser("no-ticket@example.com");
    await assertParticipation(eventUid, questionUid, user, 403);
  });

  test("lets invited attendees take part", async () => {
    await invite("invited@example.com", conferenceId, "attendee");
    const user = await emailUser("invited@example.com");
    await assertParticipation(eventUid, questionUid, user, 200);
  });

  test("lets moderators and organizers take part", async () => {
    for (const role of ["moderator", "organizer"] as const) {
      const user = await emailUser(`${role}-2@example.com`);
      await grantTestRole(user.id, conferenceId, role);
      await assertParticipation(eventUid, questionUid, user, 200);
    }
  });

  test("keeps reads public", async () => {
    assert.equal((await request("GET", `/api/v1/events/${eventUid}`)).status, 200);
    const questions = await request("GET", `/api/v1/events/${eventUid}/questions`);
    assert.equal(questions.status, 200);
  });

  test("Devcon handover grants the attendee role", async () => {
    const token = await handoverToken("ticket@example.com");
    const result = await consumeHandoverToken(token, undefined, eventUid);
    assert.ok(result.ok, "handover succeeds");

    const user = { id: result.session.user.id, token: result.session.access_token };
    assert.deepEqual(await rolesOf(user.id), [{ conferenceId, role: "attendee" }]);
    await assertParticipation(eventUid, questionUid, user, 200);
  });

  test("Devcon handover matches the event uid in any case", async () => {
    const token = await handoverToken("upper@example.com");
    const result = await consumeHandoverToken(
      token,
      undefined,
      eventUid.toUpperCase(),
    );
    assert.ok(result.ok, "handover succeeds");
    assert.deepEqual(await rolesOf(result.session.user.id), [
      { conferenceId, role: "attendee" },
    ]);
  });

  test("Devcon handover keeps an existing organizer role", async () => {
    const organizer = await emailUser("lead@example.com");
    await grantTestRole(organizer.id, conferenceId, "organizer");

    const token = await handoverToken("lead@example.com");
    const result = await consumeHandoverToken(token, undefined, eventUid);
    assert.ok(result.ok, "handover succeeds");
    assert.deepEqual(await rolesOf(organizer.id), [
      { conferenceId, role: "organizer" },
    ]);
  });

  test("Devcon handover keeps an invited first-time user's role", async () => {
    await invite("new-moderator@example.com", conferenceId, "moderator");

    const token = await handoverToken("new-moderator@example.com");
    const result = await consumeHandoverToken(token, undefined, eventUid);
    assert.ok(result.ok, "handover succeeds");
    assert.deepEqual(await rolesOf(result.session.user.id), [
      { conferenceId, role: "moderator" },
    ]);
  });
});

describe("conference without the attendees-only feature", () => {
  let eventUid: string;

  beforeEach(async () => {
    await resetDb();
    const { event } = await seedConference({ name: "Open" });
    eventUid = event.uid;
  });

  test("lets anonymous users take part", async () => {
    const author = await anonymousUser();
    const questionUid = await postedQuestionUid(eventUid, author);
    const user = await anonymousUser();
    await assertParticipation(eventUid, questionUid, user, 200);
  });

  test("Devcon handover grants no role", async () => {
    const token = await handoverToken("visitor@example.com");
    const result = await consumeHandoverToken(token, undefined, eventUid);
    assert.ok(result.ok, "handover succeeds");
    assert.deepEqual(await rolesOf(result.session.user.id), []);
  });
});
