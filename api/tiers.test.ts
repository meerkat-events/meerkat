import { test } from "node:test";
import assert from "node:assert/strict";
import { tierFor } from "./tiers.ts";

test("a small conference can't reach the top 1% or 0.1%", () => {
  assert.equal(tierFor(1, 12), 10);
  assert.equal(tierFor(2, 12), 25);
  assert.equal(tierFor(3, 12), 25);
  assert.equal(tierFor(4, 12), null);
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

test("fewer than four contributors: nobody is in the top 25%", () => {
  assert.equal(tierFor(1, 3), null);
  assert.equal(tierFor(1, 4), 25);
});
