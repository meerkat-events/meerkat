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

function recorder() {
  const received: RealtimeMessage["type"][] = [];
  const listener = (message: RealtimeMessage) => {
    received.push(message.type);
  };
  return { received, listener };
}

test("question changes reach the event's and the conference's listeners", async () => {
  const bus = createMemoryBus();
  const hub = createHub(bus);
  const event = recorder();
  const otherEvent = recorder();
  const conference = recorder();
  hub.listenToEvent(1, event.listener);
  hub.listenToEvent(2, otherEvent.listener);
  hub.listenToConference(10, conference.listener);

  await bus.publish({ type: "questions", eventId: 1, conferenceId: 10, isPublic: true });

  assert.deepEqual(event.received, ["questions"]);
  assert.deepEqual(otherEvent.received, []);
  assert.deepEqual(conference.received, ["questions"]);
});

test("reactions reach the event's listeners only", async () => {
  const bus = createMemoryBus();
  const hub = createHub(bus);
  const event = recorder();
  const conference = recorder();
  hub.listenToEvent(1, event.listener);
  hub.listenToConference(10, conference.listener);

  await bus.publish({ type: "reaction", eventId: 1, reaction });

  assert.deepEqual(event.received, ["reaction"]);
  assert.deepEqual(conference.received, []);
});

test("a question moderation hid reaches the conference's listeners only", async () => {
  const bus = createMemoryBus();
  const hub = createHub(bus);
  const event = recorder();
  const conference = recorder();
  hub.listenToEvent(1, event.listener);
  hub.listenToConference(10, conference.listener);

  await bus.publish({
    type: "questions",
    eventId: 1,
    conferenceId: 10,
    isPublic: false,
  });

  assert.deepEqual(event.received, []);
  assert.deepEqual(conference.received, ["questions"]);
});

test("an event going live reaches its own stage of its own conference", async () => {
  const bus = createMemoryBus();
  const hub = createHub(bus);
  const stage = recorder();
  const otherStage = recorder();
  const sameNameOtherConference = recorder();
  const event = recorder();
  hub.listenToStage(10, "main", stage.listener);
  hub.listenToStage(10, "side", otherStage.listener);
  hub.listenToStage(20, "main", sameNameOtherConference.listener);
  hub.listenToEvent(1, event.listener);

  await bus.publish({
    type: "live",
    eventId: 1,
    eventUid: "talk",
    title: "Talk",
    conferenceId: 10,
    stage: "main",
  });

  assert.deepEqual(stage.received, ["live"]);
  assert.deepEqual(otherStage.received, []);
  assert.deepEqual(sameNameOtherConference.received, []);
  assert.deepEqual(event.received, []);
});

test("resync reaches every listener", () => {
  const bus = createMemoryBus();
  const hub = createHub(bus);
  const event = recorder();
  const conference = recorder();
  hub.listenToEvent(1, event.listener);
  hub.listenToConference(10, conference.listener);

  bus.resync();

  assert.deepEqual(event.received, ["resync"]);
  assert.deepEqual(conference.received, ["resync"]);
});

test("a failing listener doesn't keep the message from the others", async () => {
  const bus = createMemoryBus();
  const hub = createHub(bus);
  const event = recorder();
  hub.listenToEvent(1, () => {
    throw new Error("client gone");
  });
  hub.listenToEvent(1, event.listener);

  await bus.publish({ type: "questions", eventId: 1, conferenceId: 10, isPublic: true });

  assert.deepEqual(event.received, ["questions"]);
});

test("unsubscribing removes the listener", async () => {
  const bus = createMemoryBus();
  const hub = createHub(bus);
  const event = recorder();
  const stopEvent = hub.listenToEvent(1, event.listener);
  const stopConference = hub.listenToConference(10, () => {});
  assert.equal(hub.listenerCount(), 2);

  stopEvent();
  stopConference();
  stopEvent();
  await bus.publish({ type: "questions", eventId: 1, conferenceId: 10, isPublic: true });

  assert.equal(hub.listenerCount(), 0);
  assert.deepEqual(event.received, []);
});

test("the hub subscribes to the bus once", async () => {
  const bus = createMemoryBus();
  const hub = createHub(bus);
  const event = recorder();
  hub.start();
  hub.listenToEvent(1, event.listener);
  hub.listenToEvent(1, () => {});

  await bus.publish({ type: "questions", eventId: 1, conferenceId: 10, isPublic: true });

  assert.deepEqual(event.received, ["questions"]);
});
