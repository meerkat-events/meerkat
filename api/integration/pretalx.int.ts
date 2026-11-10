import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, beforeEach, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import db from "../db.ts";
import env from "../env.ts";
import { conferences, events } from "../schema.ts";
import {
  emailUser,
  insertConference,
  insertQuestion,
  request,
  resetDb,
} from "./helpers.ts";

const PRETALX_EVENT = "testcon";

type Talk = { code: string; room: string; title: string; date: string; duration: string };

const talk = (code: string, room = "Main Stage"): Talk => ({
  code,
  room,
  title: `Talk ${code}`,
  date: "2026-11-12T10:00:00+00:00",
  duration: "00:30",
});

/** A frab schedule export, as Pretalx publishes it, with one day. */
const scheduleOf = (talks: unknown[]) => ({
  schedule: {
    version: "1.0",
    conference: { days: [{ rooms: { "Main Stage": talks } }] },
  },
});

describe("Pretalx sync", () => {
  let server: Server;
  let originalPretalxUrl: string | undefined;
  // What the fake Pretalx answers for the schedule
  let answer: { status: number; body: unknown };
  let conferenceId: number;

  const sync = (pretalxEvent = PRETALX_EVENT) =>
    request("POST", `/api/v1/pretalx/${pretalxEvent}/sync`);

  /** Lifts the one-sync-a-minute throttle, so a test can sync again. */
  const allowNextSync = () =>
    db.update(conferences).set({ pretalxSyncedAt: null })
      .where(eq(conferences.id, conferenceId));

  const eventUids = async () =>
    (await db.select({ uid: events.uid }).from(events)
      .where(eq(events.conferenceId, conferenceId)))
      .map((event) => event.uid)
      .toSorted();

  before(async () => {
    server = createServer((incoming, response) => {
      if (incoming.url !== `/${PRETALX_EVENT}/schedule/export/schedule.json`) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(answer.status, { "content-type": "application/json" });
      response.end(JSON.stringify(answer.body));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address === "object");
    originalPretalxUrl = env.pretalxUrl;
    env.pretalxUrl = `http://127.0.0.1:${address.port}`;
  });

  after(() => {
    env.pretalxUrl = originalPretalxUrl;
    server.close();
  });

  beforeEach(async () => {
    await resetDb();
    const conference = await insertConference("Testcon");
    conferenceId = conference.id;
    await db.update(conferences).set({ pretalxEvent: PRETALX_EVENT })
      .where(eq(conferences.id, conferenceId));
    answer = { status: 200, body: scheduleOf([talk("AAA"), talk("BBB")]) };
  });

  test("turns each talk into an event", async () => {
    answer.body = scheduleOf([talk("AAA", "Main Stage"), talk("BBB", "Room 2")]);

    assert.equal((await sync()).status, 200);

    const synced = await db.select().from(events)
      .where(eq(events.conferenceId, conferenceId));
    const byUid = new Map(synced.map((event) => [event.uid, event]));
    assert.equal(byUid.get("AAA")?.stage, "main-stage");
    assert.equal(byUid.get("BBB")?.stage, "room-2");
    assert.equal(byUid.get("AAA")?.title, "Talk AAA");
    assert.equal(
      byUid.get("AAA")?.end.getTime(),
      Date.parse("2026-11-12T10:30:00Z"),
    );
  });

  test("deletes a talk gone from the schedule", async () => {
    assert.equal((await sync()).status, 200);
    answer.body = scheduleOf([talk("AAA")]);
    await allowNextSync();

    assert.equal((await sync()).status, 200);

    assert.deepEqual(await eventUids(), ["AAA"]);
  });

  test("keeps a talk gone from the schedule while it is live", async () => {
    assert.equal((await sync()).status, 200);
    await db.update(events).set({ live: true }).where(eq(events.uid, "BBB"));
    answer.body = scheduleOf([talk("AAA")]);
    await allowNextSync();

    assert.equal((await sync()).status, 200);

    assert.deepEqual(await eventUids(), ["AAA", "BBB"]);
  });

  test("keeps a talk gone from the schedule that has questions", async () => {
    assert.equal((await sync()).status, 200);
    const [gone] = await db.select().from(events).where(eq(events.uid, "BBB"));
    const asker = await emailUser("asker@example.com");
    await insertQuestion(gone!.id, asker.id, "asked-in-bbb");
    answer.body = scheduleOf([talk("AAA")]);
    await allowNextSync();

    assert.equal((await sync()).status, 200);

    assert.deepEqual(await eventUids(), ["AAA", "BBB"]);
  });

  test("keeps a talk that is still listed but invalid", async () => {
    answer.body = scheduleOf([talk("AAA"), talk("BBB"), talk("CCC")]);
    assert.equal((await sync()).status, 200);
    answer.body = scheduleOf([talk("AAA"), talk("BBB"), { code: "CCC" }]);
    await allowNextSync();

    assert.equal((await sync()).status, 200);

    assert.deepEqual(await eventUids(), ["AAA", "BBB", "CCC"]);
  });

  test("syncs a conference at most once a minute", async () => {
    assert.equal((await sync()).status, 200);

    const throttled = await sync();
    assert.equal(throttled.status, 202);
    const retryAfter = Number(throttled.headers.get("Retry-After"));
    assert.ok(retryAfter > 0 && retryAfter <= 60, `Retry-After ${retryAfter}`);
  });

  test("answers 404 for a Pretalx event no conference syncs", async () => {
    assert.equal((await sync("othercon")).status, 404);
  });

  test("answers 502 and keeps the events when Pretalx fails", async () => {
    assert.equal((await sync()).status, 200);

    for (const status of [404, 500]) {
      answer = { status, body: {} };
      await allowNextSync();
      assert.equal((await sync()).status, 502, `Pretalx answering ${status}`);
    }

    answer = { status: 200, body: scheduleOf([]) };
    await allowNextSync();
    assert.equal((await sync()).status, 502, "an empty schedule");

    assert.deepEqual(await eventUids(), ["AAA", "BBB"]);
  });
});
