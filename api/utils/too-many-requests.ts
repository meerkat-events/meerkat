import { HTTPException } from "hono/http-exception";

/**
 * A 429 for a rate limit over a sliding window starting at `windowStart`.
 * `recent` holds when the user acted inside the window, oldest first, and
 * `allowed` how many of those may remain for the next action to pass.
 * Retry-After is when enough of the oldest have left the window; concurrent
 * requests can put a user more than one over. A limit without a window
 * doesn't lift with time, so it gets no Retry-After.
 */
export function tooManyRequests(
  message: string,
  window?: { recent: Date[]; allowed: number; windowStart: Date },
) {
  const headers = new Headers();
  // The last of the actions that have to leave before the user is back
  // within the limit.
  const freesSlot = window?.recent[window.recent.length - window.allowed - 1];
  if (window && freesSlot) {
    const start = window.windowStart.getTime();
    const seconds = Math.ceil((freesSlot.getTime() - start) / 1000);
    // Within the window's length, should the database and server clocks
    // disagree.
    const windowSeconds = Math.round((Date.now() - start) / 1000);
    headers.set(
      "Retry-After",
      String(Math.min(windowSeconds, Math.max(1, seconds))),
    );
  }
  return new HTTPException(429, {
    message,
    res: new Response(message, { headers }),
  });
}

/** The start of a sliding window that ends now and lasts `seconds`. */
export function windowStartSecondsAgo(seconds: number) {
  return new Date(Date.now() - seconds * 1000);
}

/**
 * Throws a 429 when the user already acted `max` times inside the window
 * starting at `windowStart` (`recent`, oldest first), so the next action
 * would go over the limit. The 429 says when to retry.
 */
export function enforceRateLimit(
  { recent, max, windowStart, message }: {
    recent: Date[];
    max: number;
    windowStart: Date;
    message: string;
  },
) {
  if (recent.length >= max) {
    throw tooManyRequests(message, { recent, allowed: max - 1, windowStart });
  }
}
