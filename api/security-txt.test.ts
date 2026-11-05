import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// RFC 9116: Expires is required and should be less than a year ahead. The
// test fails only once the file has expired, so it never blocks an unrelated
// deploy before then; a month ahead it warns in the test output instead.
const DAY_MS = 24 * 60 * 60 * 1000;
const WARNING_MS = 30 * DAY_MS;
const MAX_AHEAD_MS = 366 * DAY_MS;

const securityTxt = readFileSync(
  new URL("./public/.well-known/security.txt", import.meta.url),
  "utf8",
);

function expiresOf(text: string) {
  const line = text.split(/\r?\n/).find((l) => l.startsWith("Expires: "));
  assert.ok(line, "security.txt has no Expires field");
  const expires = new Date(line.slice("Expires: ".length));
  assert.ok(
    !Number.isNaN(expires.getTime()),
    `Expires isn't a valid date: ${line}`,
  );
  return expires;
}

test("security.txt hasn't expired and expires at most a year ahead", (t) => {
  const msLeft = expiresOf(securityTxt).getTime() - Date.now();
  const renew =
    "set Expires in api/public/.well-known/security.txt to at most a year from today";

  assert.ok(msLeft > 0, `security.txt has expired: ${renew}`);
  assert.ok(msLeft <= MAX_AHEAD_MS, "Expires is more than a year ahead");
  if (msLeft < WARNING_MS) {
    t.diagnostic(`security.txt expires within 30 days: ${renew}`);
  }
});

test("security.txt names a contact", () => {
  assert.match(securityTxt, /^Contact: https:\/\//m);
});
