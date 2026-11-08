import { test } from "node:test";
import assert from "node:assert/strict";
import { groupByState } from "./group-sessions.ts";

// Starts as ISO strings, as the API's JSON sends them.
const morning = { uid: "morning", start: "2026-11-05T09:00:00.000Z" };
const noon = { uid: "noon", start: "2026-11-05T12:00:00.000Z" };
const evening = { uid: "evening", start: "2026-11-05T18:00:00.000Z" };

const uids = (events: { uid: string }[]) => events.map((event) => event.uid);

test("without a live session, splits past and upcoming at now", () => {
  const now = new Date("2026-11-05T13:00:00.000Z");
  const groups = groupByState([morning, noon, evening], now);
  assert.deepEqual(uids(groups.past), ["morning", "noon"]);
  assert.deepEqual(uids(groups.live), []);
  assert.deepEqual(uids(groups.upcoming), ["evening"]);
});

test("with a live session, splits around its start, not now", () => {
  const now = new Date("2026-11-05T20:00:00.000Z");
  const liveNoon = { ...noon, live: true };
  const groups = groupByState([morning, liveNoon, evening], now);
  assert.deepEqual(uids(groups.past), ["morning"]);
  assert.deepEqual(uids(groups.live), ["noon"]);
  assert.deepEqual(uids(groups.upcoming), ["evening"]);
});

test("a session starting with the live one or at now is upcoming", () => {
  const parallel = { uid: "parallel", start: noon.start };
  const liveNoon = { ...noon, live: true };
  const withLive = groupByState([morning, liveNoon, parallel], new Date());
  assert.deepEqual(uids(withLive.upcoming), ["parallel"]);

  const withoutLive = groupByState([morning, noon], new Date(noon.start));
  assert.deepEqual(uids(withoutLive.past), ["morning"]);
  assert.deepEqual(uids(withoutLive.upcoming), ["noon"]);
});
