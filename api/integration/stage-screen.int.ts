import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import {
  insertConference,
  insertEvent,
  request,
  resetDb,
} from "./helpers.ts";

// Which event a stage's signage and a conference's QR code show
// (getCurrentEvent): live, else running, else next, else the one that ended
// last. Every case uses a conference and stages of its own; nothing starts
// or ends at exactly now, which would race the clock.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

beforeEach(async () => {
  await resetDb();
});

/** An event of `stage` from `startOffsetMs` to `endOffsetMs` (default: 1 h later). */
function session(
  conferenceId: number,
  stage: string,
  uid: string,
  startOffsetMs: number,
  { endOffsetMs = startOffsetMs + HOUR, live = false } = {},
) {
  return insertEvent({
    conferenceId,
    uid,
    stage,
    startOffsetMs,
    endOffsetMs,
    live,
  });
}

/** The uid the stage's signage shows, or the response status without one. */
async function stageEvent(stage: string) {
  const response = await request("GET", `/api/v1/events/stage/${stage}/live`);
  if (response.status !== 200) return response.status;
  const body = await response.json() as { data: { uid: string } };
  return body.data.uid;
}

/** The Q&A path a redirect points to, or its status without one. */
async function redirectPath(path: string) {
  const response = await request("GET", path);
  if (response.status !== 302) return response.status;
  return new URL(response.headers.get("Location")!).pathname;
}

describe("a stage", () => {
  test("shows its live event, even one that is over, before upcoming ones", async () => {
    const { id } = await insertConference("C1");
    await session(id, "c1", "c1-live", -3 * HOUR, { live: true });
    await session(id, "c1", "c1-next", HOUR);
    await session(id, "c1", "c1-later", 3 * HOUR);

    assert.equal(await stageEvent("c1"), "c1-live");
  });

  test("shows its live event before a running one", async () => {
    const { id } = await insertConference("C1b");
    await session(id, "c1b", "c1b-live", -2 * HOUR, { live: true });
    await session(id, "c1b", "c1b-running", -30 * MINUTE);

    assert.equal(await stageEvent("c1b"), "c1b-live");
  });

  test("shows the first event before the day starts", async () => {
    const { id } = await insertConference("C2");
    await session(id, "c2", "c2-first", HOUR);
    await session(id, "c2", "c2-second", 3 * HOUR);

    assert.equal(await stageEvent("c2"), "c2-first");
  });

  test("shows a running event before the next one", async () => {
    const { id } = await insertConference("C3");
    await session(id, "c3", "c3-running", -30 * MINUTE);
    await session(id, "c3", "c3-next", HOUR);

    assert.equal(await stageEvent("c3"), "c3-running");
  });

  test("shows the earliest of overlapping running events", async () => {
    const { id } = await insertConference("C3b");
    await session(id, "c3b", "c3b-earlier", -40 * MINUTE);
    await session(id, "c3b", "c3b-later", -20 * MINUTE);

    assert.equal(await stageEvent("c3b"), "c3b-earlier");
  });

  test("shows the next event between two events", async () => {
    const { id } = await insertConference("C4");
    await session(id, "c4", "c4-past", -3 * HOUR);
    await session(id, "c4", "c4-recent", -2 * HOUR);
    await session(id, "c4", "c4-next", HOUR);
    await session(id, "c4", "c4-later", 3 * HOUR);

    assert.equal(await stageEvent("c4"), "c4-next");
  });

  test("shows the last event after the day ends", async () => {
    const { id } = await insertConference("C5");
    await session(id, "c5", "c5-earlier", -3 * HOUR);
    await session(id, "c5", "c5-last", -2 * HOUR);

    assert.equal(await stageEvent("c5"), "c5-last");
  });

  test("shows the event that ended last, not the one that started last", async () => {
    const { id } = await insertConference("C5b");
    await session(id, "c5b", "c5b-long", -4 * HOUR, { endOffsetMs: -HOUR });
    await session(id, "c5b", "c5b-short", -2 * HOUR, {
      endOffsetMs: -90 * MINUTE,
    });

    assert.equal(await stageEvent("c5b"), "c5b-long");
  });

  test("ignores other stages", async () => {
    const { id } = await insertConference("C6");
    await session(id, "c6", "c6-past", -2 * HOUR);
    await session(id, "c6-other", "c6-other-next", HOUR);

    assert.equal(await stageEvent("c6"), "c6-past");
  });

  test("without events answers 404", async () => {
    assert.equal(await stageEvent("c7"), 404);
    assert.equal(await redirectPath("/stage/c7/qa"), 404);
  });

  test("redirects its Q&A link to the event it shows", async () => {
    const { id } = await insertConference("C12");
    await session(id, "c12", "c12-past", -3 * HOUR);
    await session(id, "c12", "c12-recent", -2 * HOUR);
    await session(id, "c12", "c12-next", HOUR);
    await session(id, "c12", "c12-later", 3 * HOUR);

    assert.equal(await redirectPath("/stage/c12/qa"), "/e/c12-next/qa");
  });
});

describe("a conference's QR code", () => {
  test("opens the next event on any stage after a past one", async () => {
    const { id } = await insertConference("C8");
    await session(id, "c8-a", "c8-past", -2 * HOUR);
    await session(id, "c8-b", "c8-next", HOUR);

    assert.equal(
      await redirectPath(`/api/v1/conferences/${id}/live`),
      "/e/c8-next/qa",
    );
  });

  test("opens the last event after the conference ends", async () => {
    const { id } = await insertConference("C9");
    await session(id, "c9", "c9-earlier", -3 * HOUR);
    await session(id, "c9", "c9-last", -2 * HOUR);

    assert.equal(
      await redirectPath(`/api/v1/conferences/${id}/live`),
      "/e/c9-last/qa",
    );
  });

  test("opens the live event before an upcoming one", async () => {
    const { id } = await insertConference("C10");
    await session(id, "c10-a", "c10-next", HOUR);
    await session(id, "c10-b", "c10-live", -2 * HOUR, { live: true });

    assert.equal(
      await redirectPath(`/api/v1/conferences/${id}/live`),
      "/e/c10-live/qa",
    );
  });

  test("opens a running event before an upcoming one", async () => {
    const { id } = await insertConference("C11");
    await session(id, "c11-a", "c11-running", -30 * MINUTE);
    await session(id, "c11-b", "c11-next", HOUR);

    assert.equal(
      await redirectPath(`/api/v1/conferences/${id}/live`),
      "/e/c11-running/qa",
    );
  });

  test("of a conference without events answers 404", async () => {
    const { id } = await insertConference("C13");

    assert.equal(await redirectPath(`/api/v1/conferences/${id}/live`), 404);
  });
});
