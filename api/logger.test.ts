import { test } from "node:test";
import assert from "node:assert/strict";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { pino } from "pino";
import { loggerOptions, withoutQueryDetails } from "./logger.ts";

/** A logger with the app's options that writes into the returned array. */
function captureLogs() {
  const lines: string[] = [];
  const logger = pino(loggerOptions, {
    write: (line: string) => {
      lines.push(line);
    },
  });
  return { logger, lines };
}

// Shaped like postgres-js's PostgresError, with invented values.
class FakePostgresError extends Error {
  code = "23505";
  detail = "Key (email)=(attendee@example.com) already exists.";
  parameters = ["attendee@example.com"];
  query = "insert into users (email) values ($1)";
}

test("database errors are logged without parameters or details", () => {
  const { logger, lines } = captureLogs();
  const cause = new FakePostgresError("duplicate key value");
  const error = new DrizzleQueryError(
    "insert into users (email) values ($1)",
    ["attendee@example.com"],
    cause,
  );

  logger.error({ err: error, userId: "user-1" }, "Failed");

  const output = lines.join("");
  assert.doesNotMatch(output, /attendee@example\.com/);
  const logged = JSON.parse(output);
  assert.equal(logged.userId, "user-1");
  assert.equal(logged.err.message, "Failed query");
  assert.equal(logged.err.cause.message, "duplicate key value");
  assert.equal(logged.err.cause.code, "23505");
});

test("emails, secrets and tokens are redacted at the top level and one level down; question text is kept", () => {
  const { logger, lines } = captureLogs();

  logger.info(
    {
      token: "a-handover-token",
      question: "an invented question",
      user: { email: "attendee@example.com" },
    },
    "Oops",
  );

  const logged = JSON.parse(lines.join(""));
  assert.equal(logged.token, "[Redacted]");
  assert.equal(logged.question, "an invented question");
  assert.equal(logged.user.email, "[Redacted]");
});

test("a failed query sent elsewhere loses its SQL and parameters", () => {
  const cause = new Error("connection refused");
  const error = new DrizzleQueryError(
    "select * from questions where question = $1",
    ["an invented question"],
    cause,
  );

  const sanitized = withoutQueryDetails(error);

  assert.ok(sanitized instanceof Error);
  assert.equal(sanitized.name, "DrizzleQueryError");
  assert.equal(sanitized.message, "Failed query");
  assert.equal(sanitized.cause, cause);
  assert.doesNotMatch(sanitized.stack ?? "", /select|invented/);
});

test("other errors are sent as they are", () => {
  const error = new Error("boom");
  assert.equal(withoutQueryDetails(error), error);
});
