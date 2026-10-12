import { test } from "node:test";
import assert from "node:assert/strict";
import { MIN_CONTRIBUTORS, tierFor } from "./tiers.ts";

test("nobody gets a tier below the minimum number of contributors", () => {
  assert.equal(tierFor(1, MIN_CONTRIBUTORS - 1), null);
  assert.equal(tierFor(1, MIN_CONTRIBUTORS), 10);
});

test("a small conference can't reach the top 1% or 0.1%", () => {
  assert.equal(tierFor(1, 20), 10);
  assert.equal(tierFor(2, 20), 10);
  assert.equal(tierFor(3, 20), 25);
  assert.equal(tierFor(5, 20), 25);
  assert.equal(tierFor(6, 20), null);
});

test("each tier is reached at its exact share of contributors", () => {
  assert.equal(tierFor(1, 1000), 0.1);
  assert.equal(tierFor(2, 1000), 1);
  assert.equal(tierFor(10, 1000), 1);
  assert.equal(tierFor(11, 1000), 10);
  assert.equal(tierFor(100, 1000), 10);
  assert.equal(tierFor(250, 1000), 25);
  assert.equal(tierFor(251, 1000), null);
});
