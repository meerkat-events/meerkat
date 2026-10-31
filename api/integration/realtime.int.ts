import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import db from "../db.ts";
import env from "../env.ts";
import type { Bus, RealtimeMessage } from "../realtime/bus.ts";
import { bus, hub } from "../realtime/index.ts";
import { createPostgresBus } from "../realtime/postgres-bus.ts";
import { events, questions } from "../schema.ts";
import {
  emailUser,
  grantTestRole,
  request,
  resetDb,
  seedConference,
  type TestUser,
} from "./helpers.ts";

const TIMEOUT_MS = 5_000;

/**
 * Resolves once `listening` receives what `sending` publishes, so a test
 * doesn't race the LISTEN that a bus opens on its first subscriber.
 */
async function waitUntilListening(sending: Bus, listening: Bus) {
  let isListening = false;
  const unsubscribe = listening.subscribe(() => {
    isListening = true;
  });
  const deadline = Date.now() + TIMEOUT_MS;
  while (!isListening && Date.now() < deadline) {
    await sending.publish({ type: "questions", eventId: -1, conferenceId: -1 });
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  unsubscribe();
  assert.ok(isListening, "the bus never received its own NOTIFY");
}

/**
 * Reads an SSE response until its text matches `pattern`, then closes it.
 * Returns the match, or undefined when the stream ends or times out first.
 */
async function readUntil(response: Response, pattern: RegExp) {
  const reader = response.body!.pipeThrough(new TextDecoderStream())
    .getReader();
  const deadline = setTimeout(() => void reader.cancel(), TIMEOUT_MS);
  let text = "";
  try {
    while (true) {
      const match = text.match(pattern);
      if (match) {
        return match;
      }
      const { done, value } = await reader.read();
      if (done) {
        return undefined;
      }
      text += value;
    }
  } finally {
    clearTimeout(deadline);
    await reader.cancel();
  }
}

const UPDATE = /data: update\n\n/;
const REACTION = /event: reaction\ndata: (.*)\n\n/;

const askQuestion = (eventUid: string, user: TestUser) =>
  request("POST", `/api/v1/events/${eventUid}/questions`, {
    token: user.token,
    body: { question: "How does this scale?" },
  });

describe("realtime", () => {
  beforeEach(async () => {
    await resetDb();
  });

  test("a message published on one instance reaches another", async () => {
    const instanceA = createPostgresBus(env.realtimeConnectionString);
    const instanceB = createPostgresBus(env.realtimeConnectionString);
    await waitUntilListening(instanceA, instanceB);

    const received: RealtimeMessage[] = [];
    instanceB.subscribe((message) => received.push(message));
    const reaction = {
      uid: "reaction-1",
      emoji: "heart",
      createdAt: new Date().toISOString(),
    };
    await instanceA.publish({ type: "reaction", eventId: 7, reaction });
    await new Promise((resolve) => setTimeout(resolve, 500));

    assert.deepEqual(received, [{ type: "reaction", eventId: 7, reaction }]);
  });

  test("the event stream sends an update after a question and reactions", async () => {
    const { conference, event } = await seedConference({ name: "Stream" });
    const attendee = await emailUser("attendee@example.com");
    await grantTestRole(attendee.id, conference.id, "attendee");
    await waitUntilListening(bus, bus);

    const updates = await request(
      "GET",
      `/api/v1/events/${event.uid}/questions/stream`,
    );
    assert.equal(updates.status, 200);
    assert.equal((await askQuestion(event.uid, attendee)).status, 200);
    assert.ok(await readUntil(updates, UPDATE), "no update");

    const reactions = await request(
      "GET",
      `/api/v1/events/${event.uid}/questions/stream`,
    );
    const reacted = await request("POST", `/api/v1/events/${event.uid}/react`, {
      token: attendee.token,
      body: { uid: "reaction-1", emoji: "heart" },
    });
    assert.equal(reacted.status, 200);
    const match = await readUntil(reactions, REACTION);
    assert.ok(match, "no reaction");
    const reaction = JSON.parse(match[1]!) as Record<string, unknown>;
    assert.deepEqual(Object.keys(reaction).sort(), ["createdAt", "emoji", "uid"]);
    assert.equal(reaction["uid"], "reaction-1");

    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(hub.listenerCount(), 0, "streams left listeners behind");
  });

  test("the event stream tells a stage screen about the next live event", async () => {
    const { conference, event } = await seedConference({ name: "Stage" });
    const [nextEvent] = await db.insert(events).values({
      conferenceId: conference.id,
      uid: "stage-next-talk",
      title: "Next talk",
      start: new Date(),
      end: new Date(Date.now() + 60 * 60 * 1000),
      stage: event.stage,
    }).returning();
    const organizer = await emailUser("organizer@example.com");
    await grantTestRole(organizer.id, conference.id, "organizer");
    await waitUntilListening(bus, bus);

    const screen = await request(
      "GET",
      `/api/v1/events/${event.uid}/questions/stream`,
    );
    const live = await request("POST", `/api/v1/events/${nextEvent!.uid}/live`, {
      token: organizer.token,
    });
    assert.equal(live.status, 200);
    const match = await readUntil(screen, /event: live\ndata: (.*)\n\n/);
    assert.ok(match, "no live message");
    assert.deepEqual(JSON.parse(match[1]!), { uid: "stage-next-talk" });
  });

  test("the management stream is for organizers only", async () => {
    const { conference } = await seedConference({ name: "Managed" });
    const organizer = await emailUser("organizer@example.com");
    const attendee = await emailUser("attendee@example.com");
    await grantTestRole(organizer.id, conference.id, "organizer");
    await grantTestRole(attendee.id, conference.id, "attendee");
    const path = `/api/v1/conferences/${conference.id}/questions/stream`;

    assert.equal((await request("GET", path)).status, 401);
    assert.equal(
      (await request("GET", path, { token: attendee.token })).status,
      403,
    );
    const response = await request("GET", path, { token: organizer.token });
    assert.equal(response.status, 200);
    await response.body?.cancel();
  });

  test("organizers hear about hidden questions being restored", async () => {
    const { conference, event } = await seedConference({ name: "Hidden" });
    const organizer = await emailUser("organizer@example.com");
    const author = await emailUser("author@example.com");
    await grantTestRole(organizer.id, conference.id, "organizer");
    const [hidden] = await db.insert(questions).values({
      uid: crypto.randomUUID(),
      eventId: event.id,
      userId: author.id,
      question: "Hidden by moderation",
      hiddenAt: new Date(),
    }).returning();
    await waitUntilListening(bus, bus);

    const updates = await request(
      "GET",
      `/api/v1/conferences/${conference.id}/questions/stream`,
      { token: organizer.token },
    );
    const restored = await request(
      "POST",
      `/api/v1/questions/${hidden!.uid}/restore`,
      { token: organizer.token },
    );
    assert.equal(restored.status, 200);
    assert.ok(await readUntil(updates, UPDATE), "no update");
  });
});
