import { HTTPException } from "hono/http-exception";

/**
 * A 429 for a rate limit over a sliding window starting at `windowStart`.
 * Retry-After says when the oldest action in the window, `oldest`, leaves it
 * and frees a slot. A limit without a window doesn't lift with time, so it
 * gets no Retry-After.
 */
export function tooManyRequests(
  message: string,
  window?: { oldest: Date | null; windowStart: Date },
) {
  const headers = new Headers();
  if (window?.oldest) {
    const millis = window.oldest.getTime() - window.windowStart.getTime();
    headers.set("Retry-After", String(Math.max(1, Math.ceil(millis / 1000))));
  }
  return new HTTPException(429, {
    message,
    res: new Response(message, { headers }),
  });
}
