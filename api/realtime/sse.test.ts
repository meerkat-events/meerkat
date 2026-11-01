import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { eventStream } from "./sse.ts";

test("streams keep their no-transform and no-buffering headers behind cors()", async (t) => {
  // The ping loop's sleep never fires, so the test doesn't wait 15 s.
  t.mock.timers.enable({ apis: ["setTimeout"] });

  const app = new Hono();
  app.use("/api/*", cors());
  app.get("/api/stream", (c) => eventStream(c, () => () => {}));

  const response = await app.request("/api/stream");
  await response.body?.cancel();

  assert.equal(response.headers.get("Content-Type"), "text/event-stream");
  assert.equal(response.headers.get("Cache-Control"), "no-cache, no-transform");
  assert.equal(response.headers.get("X-Accel-Buffering"), "no");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
});
