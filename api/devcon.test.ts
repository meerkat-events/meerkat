import { test } from "node:test";
import assert from "node:assert/strict";
import { sign } from "hono/jwt";
import { HandoverTokenError, verifyHandoverToken } from "./devcon.ts";

const SECRET = "devcon-test-secret";
const NOW = Date.UTC(2026, 10, 12, 9, 0, 0);
const FIVE_MINUTES = 5 * 60 * 1000;

/** A token as the Devcon app signs it: `iat`/`exp` in milliseconds. */
const devconToken = (
  payload: Record<string, unknown>,
  { secret = SECRET, alg = "HS256" }: {
    secret?: string;
    alg?: "HS256" | "HS512";
  } = {},
) => sign(payload, secret, alg);

/** Asserts that verifying `token` fails with `code`. */
async function assertRejected(
  token: string,
  code: HandoverTokenError["code"],
  now = NOW,
) {
  await assert.rejects(
    verifyHandoverToken(token, SECRET, now),
    (error) => error instanceof HandoverTokenError && error.code === code,
  );
}

test("a fresh token gives its email and times", async () => {
  const token = await devconToken({
    email: "attendee@example.com",
    iat: NOW,
    exp: NOW + FIVE_MINUTES,
  });

  assert.deepEqual(await verifyHandoverToken(token, SECRET, NOW), {
    email: "attendee@example.com",
    iat: NOW,
    exp: NOW + FIVE_MINUTES,
  });
});

test("a token is valid up to its expiry, and expired after", async () => {
  const token = await devconToken({
    email: "attendee@example.com",
    iat: NOW,
    exp: NOW + FIVE_MINUTES,
  });

  await verifyHandoverToken(token, SECRET, NOW + FIVE_MINUTES);
  await assertRejected(token, "expired", NOW + FIVE_MINUTES + 1);
});

test("times in seconds, as RFC 7519 has them, read as long expired", async () => {
  const seconds = Math.floor(NOW / 1000);
  const token = await devconToken({
    email: "attendee@example.com",
    iat: seconds,
    exp: seconds + 5 * 60,
  });

  await assertRejected(token, "expired");
});

test("a token signed with another secret is invalid", async () => {
  const token = await devconToken(
    { email: "attendee@example.com", iat: NOW, exp: NOW + FIVE_MINUTES },
    { secret: "someone-else" },
  );

  await assertRejected(token, "invalid");
});

test("a token signed with another algorithm is invalid", async () => {
  const token = await devconToken(
    { email: "attendee@example.com", iat: NOW, exp: NOW + FIVE_MINUTES },
    { alg: "HS512" },
  );

  await assertRejected(token, "invalid");
});

test("a malformed token is invalid", async () => {
  await assertRejected("not-a-jwt", "invalid");
});

test("a token without numeric times is invalid", async () => {
  await assertRejected(
    await devconToken({ email: "attendee@example.com", exp: NOW + FIVE_MINUTES }),
    "invalid",
  );
  await assertRejected(
    await devconToken({
      email: "attendee@example.com",
      iat: String(NOW),
      exp: String(NOW + FIVE_MINUTES),
    }),
    "invalid",
  );
});

test("a token without an email is invalid", async () => {
  await assertRejected(
    await devconToken({ iat: NOW, exp: NOW + FIVE_MINUTES }),
    "invalid",
  );
  await assertRejected(
    await devconToken({ email: "", iat: NOW, exp: NOW + FIVE_MINUTES }),
    "invalid",
  );
});
