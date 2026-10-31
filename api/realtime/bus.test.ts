import assert from "node:assert/strict";
import { test } from "node:test";
import { toPublishedMessage } from "./bus.ts";

test("accepts complete messages of every type", () => {
  const messages = [
    { type: "questions", eventId: 1, conferenceId: 2, isPublic: true },
    {
      type: "reaction",
      eventId: 1,
      reaction: { uid: "r", emoji: "heart", createdAt: "2026-10-31T12:00:00Z" },
    },
    {
      type: "live",
      eventId: 1,
      eventUid: "talk",
      title: "Talk",
      conferenceId: 2,
      stage: "main",
    },
  ];
  for (const message of messages) {
    assert.deepEqual(toPublishedMessage(message), message);
  }
});

test("rejects incomplete or unknown messages", () => {
  const messages: unknown[] = [
    null,
    "questions",
    { type: "questions", eventId: 1, conferenceId: 2 },
    { type: "reaction", eventId: 1 },
    { type: "reaction", eventId: 1, reaction: { uid: "r" } },
    { type: "live", eventId: 1, eventUid: "talk", conferenceId: 2 },
    { type: "check", id: "abc" },
    { type: "questions", eventId: "1", conferenceId: 2, isPublic: true },
  ];
  for (const message of messages) {
    assert.equal(toPublishedMessage(message), undefined, JSON.stringify(message));
  }
});
