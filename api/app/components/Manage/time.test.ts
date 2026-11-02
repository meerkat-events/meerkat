import { test } from "node:test";
import assert from "node:assert/strict";
import { dayKey, endOfDay, fmtDuration, startOfDay } from "./time.ts";

// Berlin changes to summer time on 29 March 2026 and back on 25 October 2026.
process.env["TZ"] = "Europe/Berlin";

const HOUR = 60 * 60_000;

test("dayKey is the local calendar day", () => {
  assert.equal(dayKey(new Date("2026-09-13T21:59:00Z")), "2026-09-13");
  assert.equal(dayKey(new Date("2026-09-13T22:00:00Z")), "2026-09-14");
  assert.equal(dayKey(new Date("2026-01-01T00:00:00+01:00")), "2026-01-01");
});

test("startOfDay and endOfDay are local midnights", () => {
  assert.equal(startOfDay("2026-09-14").toISOString(), "2026-09-13T22:00:00.000Z");
  assert.equal(endOfDay("2026-09-14").toISOString(), "2026-09-14T22:00:00.000Z");
  assert.equal(endOfDay("2026-12-31").toISOString(), "2026-12-31T23:00:00.000Z");
});

test("a day is 23 or 25 hours long on a DST change", () => {
  const length = (key: string) => endOfDay(key).getTime() - startOfDay(key).getTime();
  assert.equal(length("2026-03-29"), 23 * HOUR);
  assert.equal(length("2026-10-25"), 25 * HOUR);
  assert.equal(length("2026-10-26"), 24 * HOUR);
});

test("fmtDuration shows minutes up to a day, then days and hours", () => {
  assert.equal(fmtDuration(-HOUR), "0m");
  assert.equal(fmtDuration(0), "0m");
  assert.equal(fmtDuration(29_000), "0m");
  assert.equal(fmtDuration(30_000), "1m");
  assert.equal(fmtDuration(5 * 60_000), "5m");
  assert.equal(fmtDuration(90 * 60_000), "1h 30m");
  assert.equal(fmtDuration(24 * HOUR), "1d");
  assert.equal(fmtDuration(51 * HOUR + 59 * 60_000), "2d 3h");
});
