/**
 * Shared setup for the integration tests (`*.int.ts`), which run against the
 * local Supabase CLI stack through scripts/test-integration.sh: the database
 * and sign-in helpers of db-helpers.ts, and calls into the app.
 */
import assert from "node:assert/strict";
import app from "../app.ts";
import type { TestUser } from "./db-helpers.ts";

export * from "./db-helpers.ts";

/** Calls the app in-process, with a bearer token when given. */
export function request(
  method: string,
  path: string,
  { token, body }: { token?: string; body?: unknown } = {},
) {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  return app.request(path, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

/** Asks `question` in the event as `user`, through the API. */
export function askQuestion(
  eventUid: string,
  user: TestUser,
  question = "How does this scale?",
) {
  return request("POST", `/api/v1/events/${eventUid}/questions`, {
    token: user.token,
    body: { question },
  });
}

/** Asks a question as `user`, failing the test unless that succeeds. */
export async function postedQuestionUid(
  eventUid: string,
  user: TestUser,
  question?: string,
) {
  const response = await askQuestion(eventUid, user, question);
  assert.equal(response.status, 200);
  const body = await response.json() as { data: { uid: string } };
  return body.data.uid;
}

/** Reacts in the event as `user`, with a fresh heart unless `body` is given. */
export function react(
  eventUid: string,
  user: TestUser,
  body: { uid: string; emoji: string } = {
    uid: crypto.randomUUID(),
    emoji: "heart",
  },
) {
  return request("POST", `/api/v1/events/${eventUid}/react`, {
    token: user.token,
    body,
  });
}

/** Votes for (or removes the vote on) a question; a supervote with weight 3. */
export function upvote(questionUid: string, user: TestUser, weight?: number) {
  return request("POST", `/api/v1/questions/${questionUid}/upvote`, {
    token: user.token,
    ...(weight !== undefined ? { body: { weight } } : {}),
  });
}
