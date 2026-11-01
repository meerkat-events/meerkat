import { DrizzleQueryError } from "drizzle-orm/errors";

// Kept apart from logger.ts: posthog.ts needs these, and instrumentation.ts
// imports posthog.ts, so loading pino from here would load it before its
// instrumentation is registered and no log line would reach PostHog.

/**
 * The error without the SQL and parameters of a failed query, for sending it
 * elsewhere (PostHog error tracking, posthog.ts) by the same rule as the
 * logger's error serializer: only "Failed query", its stack frames and the
 * underlying database error are kept.
 */
export function withoutQueryDetails(error: unknown): unknown {
  if (!(error instanceof DrizzleQueryError)) {
    return error;
  }
  const sanitized = new Error("Failed query", {
    cause: withoutQueryDetails(error.cause),
  });
  sanitized.name = "DrizzleQueryError";
  sanitized.stack = `DrizzleQueryError: Failed query\n${stackFrames(error)}`;
  return sanitized;
}

/** The "at ..." lines of a stack, without the message it starts with. */
export function stackFrames(error: Error) {
  const stack = error.stack ?? "";
  const header = `${error.name}: ${error.message}`;
  return stack.startsWith(header) ? stack.slice(header.length).trim() : "";
}
