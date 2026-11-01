import { DrizzleQueryError } from "drizzle-orm/errors";
import { type LoggerOptions, pino } from "pino";

// Logs carry ids (userId, question uid, eventId, conferenceId) and may carry
// question text, but never email addresses, secrets or tokens (see
// CLAUDE.md). The serializer and the redaction below are a safety net for
// mistakes, not a replacement for choosing the logged fields.

/**
 * Logs an error as its type, message, code and stack frames only. Pino's
 * default serializer copies every property of an error: postgres-js errors
 * carry the query's `parameters` and a `detail` with the conflicting values,
 * and Drizzle's `DrizzleQueryError` puts the parameters into its message, so
 * for that one only the underlying database error is kept.
 */
function serializeError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { type: typeof error };
  }

  if (error instanceof DrizzleQueryError) {
    return {
      type: "DrizzleQueryError",
      message: "Failed query",
      stack: stackFrames(error),
      cause: serializeError(error.cause),
    };
  }

  const code = (error as { code?: unknown }).code;
  return {
    type: error.constructor.name,
    message: error.message,
    ...(typeof code === "string" || typeof code === "number" ? { code } : {}),
    stack: stackFrames(error),
    ...(error.cause !== undefined ? { cause: serializeError(error.cause) } : {}),
  };
}

/**
 * The error without the SQL and parameters of a failed query, for sending it
 * elsewhere (PostHog error tracking, posthog.ts) by the same rule as
 * `serializeError`: only "Failed query", its stack frames and the underlying
 * database error are kept.
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
function stackFrames(error: Error) {
  const stack = error.stack ?? "";
  const header = `${error.name}: ${error.message}`;
  return stack.startsWith(header) ? stack.slice(header.length).trim() : "";
}

// Field names that never belong in a log, at the top level or one level down
// (`{ user: { email } }`). Matching values are replaced with "[Redacted]".
const SENSITIVE_KEYS = [
  "email",
  "token",
  "access_token",
  "refresh_token",
  "authorization",
  "password",
  "secret",
];

/** Exported for logger.test.ts. */
export const loggerOptions: LoggerOptions = {
  level: "info",
  serializers: { err: serializeError },
  redact: SENSITIVE_KEYS.flatMap((key) => [key, `*.${key}`]),
};

const logger = pino(loggerOptions);

export default logger;
