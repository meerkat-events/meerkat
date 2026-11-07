import { type LoggerOptions, pino } from "pino";
import { stackFrames, withoutQueryDetails } from "./query-errors.ts";

// Logs carry ids (userId, question uid, eventId, conferenceId) and may carry
// question text, but never email addresses, secrets or tokens (see
// CLAUDE.md). The serializer and the redaction below are a safety net for
// mistakes, not a replacement for choosing the logged fields.

/**
 * Logs an error as its type, message, code and stack frames only. Pino's
 * default serializer copies every property of an error: postgres-js errors
 * carry the query's `parameters` and a `detail` with the conflicting values,
 * and Drizzle's `DrizzleQueryError` puts the parameters into its message, so
 * for that one only the underlying database error is kept
 * (`withoutQueryDetails`).
 */
function serializeError(unsafeError: unknown): Record<string, unknown> {
  const error = withoutQueryDetails(unsafeError);
  if (!(error instanceof Error)) {
    return { type: typeof error };
  }

  // A plain Error names its type in `name`, as the sanitized failed query
  // does; subclasses don't always set it, so for them the class name counts.
  const type = error.constructor === Error ? error.name : error.constructor.name;
  const code = (error as { code?: unknown }).code;
  return {
    type,
    message: error.message,
    ...(typeof code === "string" || typeof code === "number" ? { code } : {}),
    stack: stackFrames(error),
    ...(error.cause !== undefined ? { cause: serializeError(error.cause) } : {}),
  };
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
