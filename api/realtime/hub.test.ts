import assert from "node:assert/strict";
import { test } from "node:test";
import type { RealtimeMessage } from "./bus.ts";
import { createHub } from "./hub.ts";
import { createMemoryBus } from "./memory-bus.ts";

const reaction = {
  uid: "reaction-1",
  emoji: "heart",
  createdAt: "2026-10-31T12:00:00.000Z",
};

// Event 1 and 2 are on stage "main" of conference 10.
const event1 = { id: 1, conferenceId: 10, stage: "main" };
const event2 = { id: 2, conferenceId: 10, stage: "main" };

function recorder() {
  const received: RealtimeMessage["type"][] = [];
  const listener = (message: RealtimeMessage) => {
    received.push(message.type);
  };
  return { received, listener };
}

test("question changes reach the event's stream and its conference", async () => {
  const bus = createMemoryBus();
  const hub = createHub(bus);
  const stream = recorder();
  const otherStream = recorder();
  const conference = recorder();
  hub.listenToEventStream(event1, stream.listener);
  hub.listenToEventStream(event2, otherStream.listener);
  hub.listenToConference(10, conference.listener);

  await bus.publish({ type: "questions", eventId: 1, conferenceId: 10 });

  assert.deepEqual(stream.received, ["questions"]);
  assert.deepEqual(otherStream.received, []);
  assert.deepEqual(conference.received, ["questions"]);
});

test("reactions reach the event's stream only", async () => {
  const bus = createMemoryBus();
  const hub = createHub(bus);
  const stream = recorder();
  const conference = recorder();
  hub.listenToEventStream(event1, stream.listener);
  hub.listenToConference(10, conference.listener);

  await bus.publish({ type: "reaction", eventId: 1, reaction });

  assert.deepEqual(stream.received, ["reaction"]);
  assert.deepEqual(conference.received, []);
});

test("an event going live reaches the streams of its stage in its conference", async () => {
  const bus = createMemoryBus();
  const hub = createHub(bus);
  const sameStage = recorder();
  const otherStage = recorder();
  const sameNameOtherConference = recorder();
  hub.listenToEventStream(event1, sameStage.listener);
  hub.listenToEventStream(
    { id: 3, conferenceId: 10, stage: "side" },
    otherStage.listener,
  );
  hub.listenToEventStream(
    { id: 4, conferenceId: 20, stage: "main" },
    sameNameOtherConference.listener,
  );

  await bus.publish({
    type: "live",
    eventId: 2,
    eventUid: "talk-2",
    title: "Talk 2",
    conferenceId: 10,
    stage: "main",
  });

  assert.deepEqual(sameStage.received, ["live"]);
  assert.deepEqual(otherStage.received, []);
  assert.deepEqual(sameNameOtherConference.received, []);
});

test("resync reaches every listener once", () => {
  const bus = createMemoryBus();
  const hub = createHub(bus);
  const stream = recorder();
  const conference = recorder();
  hub.listenToEventStream(event1, stream.listener);
  hub.listenToConference(10, conference.listener);

  bus.resync();

  assert.deepEqual(stream.received, ["resync"]);
  assert.deepEqual(conference.received, ["resync"]);
});

test("a failing listener doesn't keep the message from the others", async () => {
  const bus = createMemoryBus();
  const hub = createHub(bus);
  const stream = recorder();
  hub.listenToEventStream(event1, () => {
    throw new Error("client gone");
  });
  hub.listenToEventStream(event1, stream.listener);

  await bus.publish({ type: "questions", eventId: 1, conferenceId: 10 });

  assert.deepEqual(stream.received, ["questions"]);
});

test("unsubscribing removes the listener", async () => {
  const bus = createMemoryBus();
  const hub = createHub(bus);
  const stream = recorder();
  const stopStream = hub.listenToEventStream(event1, stream.listener);
  const stopConference = hub.listenToConference(10, () => {});
  assert.equal(hub.listenerCount(), 2);

  stopStream();
  stopConference();
  stopStream();
  await bus.publish({ type: "questions", eventId: 1, conferenceId: 10 });

  assert.equal(hub.listenerCount(), 0);
  assert.deepEqual(stream.received, []);
});

test("the hub subscribes to the bus once", async () => {
  const bus = createMemoryBus();
  const hub = createHub(bus);
  const stream = recorder();
  hub.start();
  hub.listenToEventStream(event1, stream.listener);
  hub.listenToEventStream(event1, () => {});

  await bus.publish({ type: "questions", eventId: 1, conferenceId: 10 });

  assert.deepEqual(stream.received, ["questions"]);
});
