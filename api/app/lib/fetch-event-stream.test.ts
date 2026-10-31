import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createEventStreamParser,
  type EventStreamMessage,
} from "./fetch-event-stream.ts";

function parseAll(chunks: string[]) {
  const messages: EventStreamMessage[] = [];
  const parse = createEventStreamParser((message) => messages.push(message));
  for (const chunk of chunks) {
    parse(chunk);
  }
  return messages;
}

test("parses unnamed and named messages", () => {
  assert.deepEqual(
    parseAll([
      'data: update\n\nevent: reaction\ndata: {"uid":"a"}\n\n',
    ]),
    [
      { event: "message", data: "update" },
      { event: "reaction", data: '{"uid":"a"}' },
    ],
  );
});

test("joins chunks that split a message anywhere", () => {
  assert.deepEqual(
    parseAll(["da", "ta: up", "date\r", "\n", "\r\n", "data: ping\n", "\n"]),
    [{ event: "message", data: "update" }, { event: "message", data: "ping" }],
  );
});

test("joins multi-line data and ignores comments and other fields", () => {
  assert.deepEqual(
    parseAll([": keep-alive\nid: 7\nretry: 1000\ndata: a\ndata: b\n\n"]),
    [{ event: "message", data: "a\nb" }],
  );
});

test("emits nothing for a message that hasn't ended", () => {
  assert.deepEqual(parseAll(["data: update\n"]), []);
});
