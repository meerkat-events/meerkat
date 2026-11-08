import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import db from "../db.ts";
import type { QuestionModeration } from "../moderation.ts";
import { events, questions } from "../schema.ts";
import { PUBLIC_ROUTES } from "../testing/route-lists.ts";
import {
  emailUser,
  insertQuestion,
  request,
  resetDb,
  seedConference,
  type TestUser,
} from "./helpers.ts";

// Public responses never carry hidden questions, moderation fields or emails
// (CLAUDE.md, "Auth and roles"), whoever asks: a guest, or someone signed in
// who isn't the hidden question's author.

const FORBIDDEN_KEYS = ["hiddenAt", "moderation", "email"];

/** Every key and every string value anywhere in a JSON value. */
function keysAndStrings(value: unknown, found = { keys: [] as string[], strings: [] as string[] }) {
  if (typeof value === "string") {
    found.strings.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) keysAndStrings(item, found);
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      found.keys.push(key);
      keysAndStrings(item, found);
    }
  }
  return found;
}

describe("public responses", () => {
  // A concrete URL for every public JSON route
  const samples = new Map<string, string>();
  let hiddenUid: string;
  let visibleUid: string;
  let signedIn: TestUser;

  before(async () => {
    await resetDb();
    const { event } = await seedConference({ name: "Public" });
    // Live, in high engagement mode: the event then lists recently answered
    // questions too.
    await db.update(events).set({ live: true, highEngagement: true })
      .where(eq(events.id, event.id));

    const asker = await emailUser("asker@example.com");
    const author = await emailUser("hidden-author@example.com");
    signedIn = await emailUser("viewer@example.com");

    const scores = { flagged: 0.9, politics: 0, war: 0, safety: 0, selfHarm: 0 };
    const hiddenVerdict: QuestionModeration = {
      ...scores,
      category: "harassment",
      decision: "hide",
      relevance: 1,
      model: "test/model",
    };
    const keptVerdict: QuestionModeration = {
      ...scores,
      flagged: 0.1,
      category: "harassment",
      decision: "show",
      relevance: 3,
      model: "test/model",
    };
    const visible = await insertQuestion(event.id, asker.id, "visible");
    const hidden = await insertQuestion(event.id, author.id, "hidden");
    hiddenUid = hidden.uid;
    visibleUid = visible.uid;
    const answeredAt = new Date();
    await db.update(questions)
      .set({ answeredAt, selectedAt: answeredAt, moderation: keptVerdict })
      .where(eq(questions.id, visible.id));
    await db.update(questions)
      .set({ answeredAt, selectedAt: answeredAt, hiddenAt: answeredAt, moderation: hiddenVerdict })
      .where(eq(questions.id, hidden.id));

    samples.set("GET /api/v1/health", "/api/v1/health");
    samples.set("GET /api/v1/events/:uid", `/api/v1/events/${event.uid}`);
    samples.set("GET /api/v1/events/:uid/questions", `/api/v1/events/${event.uid}/questions`);
    samples.set("GET /api/v1/events", `/api/v1/events?stage=${event.stage}`);
    samples.set("GET /api/v1/events/stage/:stage/live", `/api/v1/events/stage/${event.stage}/live`);
  });

  test("every public JSON route has a sample here", () => {
    const jsonRoutes = Object.entries(PUBLIC_ROUTES)
      .filter(([, kind]) => kind === "json")
      .map(([route]) => route);
    assert.deepEqual([...samples.keys()].toSorted(), jsonRoutes.toSorted());
  });

  for (const viewer of ["a guest", "someone signed in"] as const) {
    test(`leak no hidden question, moderation field or email to ${viewer}`, async () => {
      for (const [route, url] of samples) {
        const response = await request("GET", url, {
          ...(viewer === "someone signed in" ? { token: signedIn.token } : {}),
        });
        assert.equal(response.status, 200, `${route} answered ${response.status}`);
        const { keys, strings } = keysAndStrings(await response.json());

        for (const key of FORBIDDEN_KEYS) {
          assert.ok(!keys.includes(key), `${route} carries "${key}"`);
        }
        assert.ok(!strings.includes(hiddenUid), `${route} carries the hidden question`);
        if (route === "GET /api/v1/events/:uid/questions") {
          assert.ok(strings.includes(visibleUid), "the visible question is listed");
        }
        assert.ok(
          !strings.some((string) => string.includes("@example.com")),
          `${route} carries an email`,
        );
      }
    });
  }
});
