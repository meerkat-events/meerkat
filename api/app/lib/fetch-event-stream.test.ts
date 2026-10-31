import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  createEventStreamParser,
  type EventStreamMessage,
  readEventStream,
} from "./fetch-event-stream.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** A response streaming `text`, then ending, as a closed connection does. */
function streamResponse(text: string) {
  return new Response(new Blob([text]).stream(), {
    headers: { "Content-Type": "text/event-stream" },
  });
}

test("reconnects after the stream ends and reports the re-open once", async () => {
  const answers = [
    streamResponse("data: update\n\n"),
    streamResponse("data: update\n\n"),
    new Response(null, { status: 403 }),
  ];
  const authorizations: (string | null)[] = [];
  globalThis.fetch = (_input, init) => {
    authorizations.push(new Headers(init?.headers).get("Authorization"));
    return Promise.resolve(answers.shift()!);
  };

  let token = "first";
  const messages: string[] = [];
  let reconnects = 0;
  await readEventStream({
    url: "http://localhost/stream",
    getToken: () => {
      const current = token;
      token = "refreshed";
      return current;
    },
    onMessage: (message) => messages.push(message.data),
    onReconnect: () => {
      reconnects += 1;
    },
    signal: new AbortController().signal,
  });

  // Two streams, then the 403 stops the reader on its own.
  assert.deepEqual(messages, ["update", "update"]);
  assert.equal(reconnects, 1);
  assert.deepEqual(authorizations, [
    "Bearer first",
    "Bearer refreshed",
    "Bearer refreshed",
  ]);
});

test("aborting the signal ends the reader", async () => {
  globalThis.fetch = () => Promise.reject(new Error("offline"));
  const controller = new AbortController();
  const reading = readEventStream({
    url: "http://localhost/stream",
    getToken: () => undefined,
    onMessage: () => {},
    signal: controller.signal,
  });
  controller.abort();
  await reading;
});

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
