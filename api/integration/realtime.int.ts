import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import { eq, sql } from "drizzle-orm";
import db from "../db.ts";
import env from "../env.ts";
import type { Bus, RealtimeMessage } from "../realtime/bus.ts";
import { bus, hub } from "../realtime/index.ts";
import { createPostgresBus } from "../realtime/postgres-bus.ts";
import { SUPERVOTES_FEATURE } from "../models/supervotes.ts";
import {
  conferences,
  events,
  questions,
  supervoteBalances,
} from "../schema.ts";
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
    const instanceA = createPostgresBus(env.connectionString);
    const instanceB = createPostgresBus(env.connectionString);
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
    assert.deepEqual(JSON.parse(match[1]!), {
      uid: "stage-next-talk",
      title: "Next talk",
    });
  });

});

/** Everything a stream sends within `ms`, then closes it. */
async function readFor(response: Response, ms: number) {
  const reader = response.body!.pipeThrough(new TextDecoderStream())
    .getReader();
  const stop = setTimeout(() => void reader.cancel(), ms);
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        return text;
      }
      text += value;
    }
  } catch {
    return text;
  } finally {
    clearTimeout(stop);
  }
}

// The Q&A page (useEventQuestions) and the stage screen (Presenter) both
// read `/api/v1/events/:uid/questions/stream`, so every attendee and
// moderator action must reach it. The organizer stream gets light checks
// only: it hears about changes, and like every stream, nothing about
// questions moderation hid.
describe("realtime for every action on the Q&A page and the stage screen", () => {
  type Setup = {
    eventUid: string;
    conferenceId: number;
    questionUid: string;
    asker: TestUser;
    voter: TestUser;
    organizer: TestUser;
  };
  let setup: Setup;

  beforeEach(async () => {
    await resetDb();
    const { conference, event } = await seedConference({
      name: "Actions",
      featureNames: [SUPERVOTES_FEATURE],
    });
    const asker = await emailUser("asker@example.com");
    const voter = await emailUser("voter@example.com");
    const organizer = await emailUser("organizer@example.com");
    await grantTestRole(organizer.id, conference.id, "organizer");
    // One supervote to spend.
    await db.insert(supervoteBalances).values({ userId: voter.id, balance: 1 });

    const asked = await askQuestion(event.uid, asker);
    assert.equal(asked.status, 200);
    const { data } = await asked.json() as { data: { uid: string } };
    setup = {
      eventUid: event.uid,
      conferenceId: conference.id,
      questionUid: data.uid,
      asker,
      voter,
      organizer,
    };
    await waitUntilListening(bus, bus);
  });

  type ListedQuestion = {
    uid: string;
    question: string;
    votes: number;
    selectedAt: string | null;
    answeredAt: string | null;
    vote: { weight: number } | null;
  };

  // What the Q&A page refetches after an `update`, as the voter sees it.
  async function refetchQuestions(s: Setup) {
    const response = await request(
      "GET",
      `/api/v1/events/${s.eventUid}/questions`,
      { token: s.voter.token },
    );
    assert.equal(response.status, 200);
    const { data } = await response.json() as { data: ListedQuestion[] };
    return data;
  }

  // `prepare` runs before the stream opens, so its own messages don't count.
  // `expect` checks what a refetch returns as soon as the `update` arrives,
  // so an update sent before the change is written fails.
  const questionActions: {
    name: string;
    prepare?: (setup: Setup) => Promise<void>;
    // `request` answers like Hono's app.request: a Response or its promise.
    act: (setup: Setup) => Response | Promise<Response>;
    expect: (listed: ListedQuestion[], setup: Setup) => void;
  }[] = [
    {
      name: "asking",
      act: (s) =>
        request("POST", `/api/v1/events/${s.eventUid}/questions`, {
          token: s.voter.token,
          body: { question: "And what about privacy?" },
        }),
      expect: (listed) => {
        assert.ok(
          listed.some((q) => q.question === "And what about privacy?"),
          "the new question is listed",
        );
      },
    },
    {
      name: "voting",
      act: (s) =>
        request("POST", `/api/v1/questions/${s.questionUid}/upvote`, {
          token: s.voter.token,
        }),
      expect: (listed, s) => {
        const question = listed.find((q) => q.uid === s.questionUid);
        assert.equal(question?.votes, 1);
        assert.deepEqual(question?.vote, { weight: 1 });
      },
    },
    {
      name: "removing a vote",
      prepare: async (s) => {
        const voted = await request(
          "POST",
          `/api/v1/questions/${s.questionUid}/upvote`,
          { token: s.voter.token },
        );
        assert.equal(voted.status, 200, "first vote");
      },
      // The upvote route toggles: voting again removes the vote.
      act: (s) =>
        request("POST", `/api/v1/questions/${s.questionUid}/upvote`, {
          token: s.voter.token,
        }),
      expect: (listed, s) => {
        const question = listed.find((q) => q.uid === s.questionUid);
        assert.equal(question?.votes, 0);
        assert.equal(question?.vote, null);
      },
    },
    {
      name: "supervoting",
      act: (s) =>
        request("POST", `/api/v1/questions/${s.questionUid}/upvote`, {
          token: s.voter.token,
          body: { weight: 3 },
        }),
      expect: (listed, s) => {
        const question = listed.find((q) => q.uid === s.questionUid);
        assert.equal(question?.votes, 3);
        assert.deepEqual(question?.vote, { weight: 3 });
      },
    },
    {
      name: "selecting a question for the stage",
      act: (s) =>
        request("POST", `/api/v1/questions/${s.questionUid}/select`, {
          token: s.organizer.token,
        }),
      expect: (listed, s) => {
        const question = listed.find((q) => q.uid === s.questionUid);
        assert.ok(question?.selectedAt, "selectedAt is set");
      },
    },
    {
      name: "marking a question answered",
      act: (s) =>
        request("POST", `/api/v1/questions/${s.questionUid}/mark-as-answered`, {
          token: s.organizer.token,
        }),
      expect: (listed, s) => {
        const question = listed.find((q) => q.uid === s.questionUid);
        assert.ok(question?.answeredAt, "answeredAt is set");
      },
    },
    {
      name: "deleting a question",
      act: (s) =>
        request("DELETE", `/api/v1/questions/${s.questionUid}`, {
          token: s.organizer.token,
        }),
      expect: (listed, s) => {
        assert.ok(
          !listed.some((q) => q.uid === s.questionUid),
          "the question is gone",
        );
      },
    },
    {
      name: "blocking the asker",
      act: (s) =>
        request("POST", `/api/v1/users/${s.asker.id}/block`, {
          token: s.organizer.token,
        }),
      expect: (listed, s) => {
        assert.ok(
          !listed.some((q) => q.uid === s.questionUid),
          "the blocked user's question is gone",
        );
      },
    },
    {
      name: "restoring a question moderation hid",
      prepare: async (s) => {
        await db.update(questions).set({ hiddenAt: new Date() })
          .where(eq(questions.uid, s.questionUid));
      },
      act: (s) =>
        request("POST", `/api/v1/questions/${s.questionUid}/restore`, {
          token: s.organizer.token,
        }),
      expect: (listed, s) => {
        assert.ok(
          listed.some((q) => q.uid === s.questionUid),
          "the restored question is listed",
        );
      },
    },
  ];

  for (const { name, prepare, act, expect } of questionActions) {
    test(`${name} sends an update to the event stream`, async () => {
      await prepare?.(setup);
      // Let messages from setup and `prepare` pass before the stream opens.
      await new Promise((resolve) => setTimeout(resolve, 300));

      const stream = await request(
        "GET",
        `/api/v1/events/${setup.eventUid}/questions/stream`,
      );
      const response = await act(setup);

      assert.equal(response.status, 200, await response.clone().text());
      assert.ok(await readUntil(stream, UPDATE), "no update");
      expect(await refetchQuestions(setup), setup);
    });
  }

  test("a reaction reaches the event stream with its public fields only", async () => {
    const stream = await request(
      "GET",
      `/api/v1/events/${setup.eventUid}/questions/stream`,
    );
    const reacted = await request(
      "POST",
      `/api/v1/events/${setup.eventUid}/react`,
      { token: setup.voter.token, body: { uid: "reaction-2", emoji: "heart" } },
    );
    assert.equal(reacted.status, 200);

    const match = await readUntil(stream, REACTION);
    assert.ok(match, "no reaction");
    const reaction = JSON.parse(match[1]!) as Record<string, unknown>;
    assert.deepEqual(Object.keys(reaction).sort(), ["createdAt", "emoji", "uid"]);

    // readUntil closed the stream; its hub listeners must be gone.
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(hub.listenerCount(), 0, "the stream left listeners behind");
  });

  test("the organizer stream hears about question changes, without a token", async () => {
    const stream = await request(
      "GET",
      `/api/v1/conferences/${setup.conferenceId}/questions/stream`,
    );
    assert.equal(stream.status, 200);
    const voted = await request(
      "POST",
      `/api/v1/questions/${setup.questionUid}/upvote`,
      { token: setup.voter.token },
    );
    assert.equal(voted.status, 200);
    assert.ok(await readUntil(stream, UPDATE), "no update");
  });

  describe("with moderation on", () => {
    const realFetch = globalThis.fetch;
    const realKey = env.openRouterApiKey;

    beforeEach(async () => {
      // The classifier's provider refuses, which hides the question (see
      // classifier.ts readRefusal); every other request goes through.
      env.openRouterApiKey = "test-key";
      globalThis.fetch = async (input, init) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url.startsWith("https://openrouter.ai/")) {
          return Response.json(
            { error: { message: "OpenAI refused to answer question" } },
            { status: 502 },
          );
        }
        return await realFetch(input, init);
      };
      await db.update(conferences)
        .set({ moderation: { context: "A test conference." } })
        .where(eq(conferences.id, setup.conferenceId));
    });

    afterEach(() => {
      globalThis.fetch = realFetch;
      env.openRouterApiKey = realKey;
    });

    test("a question moderation hid reaches no stream", async () => {
      const eventStream = await request(
        "GET",
        `/api/v1/events/${setup.eventUid}/questions/stream`,
      );
      const organizerStream = await request(
        "GET",
        `/api/v1/conferences/${setup.conferenceId}/questions/stream`,
      );

      const asked = await askQuestion(setup.eventUid, setup.voter);
      assert.equal(asked.status, 200);
      const [hidden] = await db.select({ hiddenAt: questions.hiddenAt })
        .from(questions)
        .where(eq(questions.userId, setup.voter.id));
      assert.ok(hidden?.hiddenAt, "the classifier stub hid the question");

      const [eventText, organizerText] = await Promise.all([
        readFor(eventStream, 1_000),
        readFor(organizerStream, 1_000),
      ]);
      assert.doesNotMatch(eventText, UPDATE, "event stream");
      assert.doesNotMatch(organizerText, UPDATE, "organizer stream");
    });
  });

  test("clients resync after the LISTEN connection drops", async () => {
    const stream = await request(
      "GET",
      `/api/v1/events/${setup.eventUid}/questions/stream`,
    );
    // Kill this process's LISTEN connection, as a database restart would.
    const killed = await db.execute<{ pg_terminate_backend: boolean }>(sql`
      SELECT pg_terminate_backend(pid) FROM pg_stat_activity
      WHERE query ILIKE 'listen %meerkat_realtime%'
    `);
    assert.ok(killed.length > 0, "found the LISTEN connection");

    // postgres.js reconnects and the bus delivers `resync`: an `update`.
    assert.ok(await readUntil(stream, UPDATE), "no resync update");

    // Messages flow again after the reconnect.
    const next = await request(
      "GET",
      `/api/v1/events/${setup.eventUid}/questions/stream`,
    );
    assert.equal((await askQuestion(setup.eventUid, setup.voter)).status, 200);
    assert.ok(await readUntil(next, UPDATE), "no update after reconnect");
  });
});
