import assert from "node:assert/strict";
import { test } from "node:test";
import { reconnectDelayMs } from "./reconnect-delay.ts";

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
    assert.ok(reconnectDelayMs(0) < 1000);
    assert.ok(reconnectDelayMs(1) > 1000 && reconnectDelayMs(1) < 2000);
    assert.ok(reconnectDelayMs(3) > 4000 && reconnectDelayMs(3) < 8000);
  });
});

test("the ceiling stops at 30 seconds", () => {
  withRandom(0.999, () => {
    assert.ok(reconnectDelayMs(10) < 30_000);
    assert.ok(reconnectDelayMs(100) < 30_000);
  });
});

test("the wait is random from zero up to the ceiling", () => {
  withRandom(0, () => {
    assert.equal(reconnectDelayMs(5), 0);
  });
  withRandom(0.5, () => {
    assert.equal(reconnectDelayMs(2), 2000);
  });
});
