import type { Context } from "hono";
import { type SSEMessage, streamSSE } from "hono/streaming";

// Clients reset a watchdog on every message (packages/react's
// useEventSource), and proxies keep a connection open that carries data.
const PING_INTERVAL_MS = 30_000;

const MIN_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 4000;

/** A random SSE `retry:` delay, so reconnects don't all arrive at once. */
function reconnectDelayMs(): number {
  const spread = MAX_RECONNECT_DELAY_MS - MIN_RECONNECT_DELAY_MS;
  return MIN_RECONNECT_DELAY_MS + Math.floor(Math.random() * spread);
}

export type SendMessage = (message: SSEMessage) => void;

/**
 * Answers with an SSE stream. `listen` registers how hub messages become SSE
 * messages and returns its unsubscribe, which runs when the client goes away.
 * Opens with a `ping` carrying a random `retry:`, so after a restart clients
 * come back spread over a few seconds instead of all in the same one, and
 * sends `ping` every 30 seconds after that.
 */
export function eventStream(
  c: Context,
  listen: (send: SendMessage) => () => void,
) {
  return streamSSE(c, async (stream) => {
    // Writes are chained, so they keep their order, and `send` returns at
    // once: the hub never waits for a slow client. A failed write means the
    // client is gone, which `onAbort` cleans up.
    let writes = Promise.resolve();
    const send: SendMessage = (message) => {
      writes = writes.then(() => stream.writeSSE(message)).catch(() => {});
    };

    send({ data: "ping", retry: reconnectDelayMs() });
    const unsubscribe = listen(send);
    stream.onAbort(unsubscribe);

    // `abort()` sets `aborted` but not `closed`, so both end the loop.
    while (!stream.aborted && !stream.closed) {
      await stream.sleep(PING_INTERVAL_MS);
      send({ data: "ping" });
    }
    unsubscribe();
  });
}
