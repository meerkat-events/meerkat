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

type Counts = { questions: number; votes: number; reactions: number; participants: number };
type Stats = { totals: Counts; events: (Counts & { eventId: number })[] };

describe("the analytics counts", () => {
  let conferenceId: number;
  let eventId: number;
  let eventUid: string;
  let organizer: TestUser;

  const ask = async (user: TestUser) => {
    const response = await request("POST", `/api/v1/events/${eventUid}/questions`, {
      token: user.token,
      body: { question: "How does this scale?" },
    });
    assert.equal(response.status, 200);
    return (await response.json() as { data: { uid: string } }).data.uid;
  };

  const stats = async () => {
    const response = await request("GET", `/api/v1/conferences/${conferenceId}/stats`, {
      token: organizer.token,
    });
    assert.equal(response.status, 200);
    return (await response.json() as { data: Stats }).data;
  };

  beforeEach(async () => {
    await resetDb();
    const { conference, event } = await seedConference({ name: "Analytics" });
    conferenceId = conference.id;
    eventId = event.id;
    eventUid = event.uid;
    organizer = await emailUser("organizer@example.com");
    await grantTestRole(organizer.id, conference.id, "organizer");
  });

  test("hidden and deleted questions don't count, every vote and reaction does", async () => {
    const asker = await anonymousUser();
    await ask(asker);

    // Voted on before an organizer hid it: the vote still counts, the question
    // and its author don't.
    const hiddenAuthor = await anonymousUser();
    const hiddenUid = await ask(hiddenAuthor);
    const voter = await anonymousUser();
    const voted = await request("POST", `/api/v1/questions/${hiddenUid}/upvote`, { token: voter.token });
    assert.equal(voted.status, 200);
    const hidden = await request("POST", `/api/v1/questions/${hiddenUid}/hide`, { token: organizer.token });
    assert.equal(hidden.status, 200);

    const deletedAuthor = await anonymousUser();
    const deletedUid = await ask(deletedAuthor);
    const deleted = await request("DELETE", `/api/v1/questions/${deletedUid}`, { token: organizer.token });
    assert.equal(deleted.status, 200);

    // Someone who only reacts takes part too.
    const reactor = await anonymousUser();
    const reacted = await request("POST", `/api/v1/events/${eventUid}/react`, {
      token: reactor.token,
      body: { uid: globalThis.crypto.randomUUID(), emoji: "fire" },
    });
    assert.equal(reacted.status, 200);

    const expected = { questions: 1, votes: 1, reactions: 1, participants: 3 };
    const { totals, events } = await stats();
    assert.deepEqual(totals, expected);
    const session = events.find((e) => e.eventId === eventId);
    assert.ok(session);
    const { questions, votes, reactions, participants } = session;
    assert.deepEqual({ questions, votes, reactions, participants }, expected);
  });
});
