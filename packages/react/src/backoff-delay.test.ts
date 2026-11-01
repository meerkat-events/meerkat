import assert from "node:assert/strict";
import { test } from "node:test";
import { backoffDelayMs } from "./backoff-delay.ts";

function withRandom(value: number, run: () => void) {
  const original = Math.random;
  Math.random = () => value;
  try {
    run();
  } finally {
    Math.random = original;
  }
}

test("the ceiling doubles with every failure", () => {
  withRandom(0.999, () => {
    assert.ok(backoffDelayMs(0) < 1000);
    assert.ok(backoffDelayMs(1) > 1000 && backoffDelayMs(1) < 2000);
    assert.ok(backoffDelayMs(3) > 4000 && backoffDelayMs(3) < 8000);
  });
});

test("the ceiling stops at 30 seconds", () => {
  withRandom(0.999, () => {
    assert.ok(backoffDelayMs(10) < 30_000);
    assert.ok(backoffDelayMs(100) < 30_000);
  });
});

test("the wait is random from zero up to the ceiling", () => {
  withRandom(0, () => {
    assert.equal(backoffDelayMs(5), 0);
  });
  withRandom(0.5, () => {
    assert.equal(backoffDelayMs(2), 2000);
  });
});
