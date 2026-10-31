import assert from "node:assert/strict";
import { test } from "node:test";
import {
  eventStreamEvents,
  type LiveSession,
  type StreamReaction,
} from "./event-stream-events.ts";

test("parses reactions and live sessions into their callbacks", () => {
  const reactions: StreamReaction[] = [];
  const sessions: LiveSession[] = [];
  const events = eventStreamEvents({
    onReaction: (reaction) => reactions.push(reaction),
    onEventLive: (session) => sessions.push(session),
  });

  events.reaction('{"uid":"r1","emoji":"heart","createdAt":"2026-10-31T12:00:00Z"}');
  events.live('{"uid":"talk-b","title":"Talk B"}');

  assert.deepEqual(reactions, [
    { uid: "r1", emoji: "heart", createdAt: "2026-10-31T12:00:00Z" },
  ]);
  assert.deepEqual(sessions, [{ uid: "talk-b", title: "Talk B" }]);
});

test("ignores events without a callback", () => {
  const events = eventStreamEvents({});
  events.reaction('{"uid":"r1","emoji":"heart","createdAt":"x"}');
  events.live('{"uid":"talk-b","title":"Talk B"}');
});
