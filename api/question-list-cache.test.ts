import assert from "node:assert/strict";
import { test } from "node:test";
import type { Questions, Sort } from "./models/questions.ts";
import { createQuestionListCache } from "./question-list-cache.ts";
import { createMemoryBus } from "./realtime/memory-bus.ts";

// Each load returns a list of its own, so tests can tell loads apart.
function counter() {
  const loads: { eventId: number; sort: Sort }[] = [];
  const load = (eventId: number, sort: Sort) => {
    loads.push({ eventId, sort });
    return Promise.resolve([] as Questions);
  };
  return { loads, load };
}

test("requests share one load", async () => {
  const { loads, load } = counter();
  const cache = createQuestionListCache({ bus: createMemoryBus(), load });

  const [first, second] = await Promise.all([
    cache.get(1, "popular"),
    cache.get(1, "popular"),
  ]);
  const third = await cache.get(1, "popular");

  assert.equal(loads.length, 1);
  assert.equal(first, second);
  assert.equal(first, third);
});

test("events and sorts are loaded separately", async () => {
  const { loads, load } = counter();
  const cache = createQuestionListCache({ bus: createMemoryBus(), load });

  await cache.get(1, "popular");
  await cache.get(1, "newest");
  await cache.get(2, "popular");

  assert.deepEqual(loads, [
    { eventId: 1, sort: "popular" },
    { eventId: 1, sort: "newest" },
    { eventId: 2, sort: "popular" },
  ]);
});

test("a change to the event's questions drops both of its lists", async () => {
  const { loads, load } = counter();
  const bus = createMemoryBus();
  const cache = createQuestionListCache({ bus, load });
  await cache.get(1, "popular");
  await cache.get(1, "newest");
  await cache.get(2, "popular");

  await bus.publish({ type: "questions", eventId: 1, conferenceId: 10 });
  await cache.get(1, "popular");
  await cache.get(1, "newest");
  await cache.get(2, "popular");

  assert.equal(loads.length, 5);
});

test("a load that started before a change isn't handed out after it", async () => {
  const bus = createMemoryBus();
  let loadCount = 0;
  let finishFirstLoad = (_questions: Questions) => {};
  const load = () => {
    loadCount += 1;
    if (loadCount === 1) {
      return new Promise<Questions>((resolve) => {
        finishFirstLoad = resolve;
      });
    }
    return Promise.resolve([] as Questions);
  };
  const cache = createQuestionListCache({ bus, load });

  const beforeChange = cache.get(1, "popular");
  await bus.publish({ type: "questions", eventId: 1, conferenceId: 10 });
  const afterChange = cache.get(1, "popular");
  finishFirstLoad([] as Questions);
  await Promise.all([beforeChange, afterChange]);
  await cache.get(1, "popular");

  assert.equal(loadCount, 2);
  assert.notEqual(beforeChange, afterChange);
});

test("reactions and live sessions keep the lists", async () => {
  const { loads, load } = counter();
  const bus = createMemoryBus();
  const cache = createQuestionListCache({ bus, load });
  await cache.get(1, "popular");

  await bus.publish({
    type: "reaction",
    eventId: 1,
    reaction: { uid: "r", emoji: "heart", createdAt: "2026-11-01T10:00:00Z" },
  });
  await bus.publish({
    type: "live",
    eventId: 1,
    eventUid: "abc",
    title: "Talk",
    conferenceId: 10,
    stage: "main",
  });
  await cache.get(1, "popular");

  assert.equal(loads.length, 1);
});

test("a resync drops every list", async () => {
  const { loads, load } = counter();
  const bus = createMemoryBus();
  const cache = createQuestionListCache({ bus, load });
  await cache.get(1, "popular");
  await cache.get(2, "popular");

  bus.resync();
  await cache.get(1, "popular");
  await cache.get(2, "popular");

  assert.equal(loads.length, 4);
});

test("a list expires after the time limit", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { loads, load } = counter();
  const cache = createQuestionListCache({
    bus: createMemoryBus(),
    load,
    ttlMs: 1000,
  });
  await cache.get(1, "popular");

  t.mock.timers.tick(999);
  await cache.get(1, "popular");
  t.mock.timers.tick(1);
  await cache.get(1, "popular");

  assert.equal(loads.length, 2);
});

test("a failed load isn't kept", async () => {
  let loadCount = 0;
  const load = () => {
    loadCount += 1;
    return loadCount === 1
      ? Promise.reject(new Error("database down"))
      : Promise.resolve([] as Questions);
  };
  const cache = createQuestionListCache({ bus: createMemoryBus(), load });

  await assert.rejects(cache.get(1, "popular"), /database down/);
  assert.deepEqual(await cache.get(1, "popular"), []);
  assert.equal(loadCount, 2);
});

test("forgetting an event drops its lists without a message", async () => {
  const { loads, load } = counter();
  const cache = createQuestionListCache({ bus: createMemoryBus(), load });
  await cache.get(1, "popular");
  await cache.get(2, "popular");

  cache.forget(1);
  await cache.get(1, "popular");
  await cache.get(2, "popular");

  assert.equal(loads.length, 3);
});
