import assert from "node:assert/strict";
import { test } from "node:test";
import { stageScreenSearchParams } from "./stage-screen.ts";

test("the stage screen keeps its options when it moves on", () => {
  const current = new URLSearchParams("hide-qr-code=true");

  const next = stageScreenSearchParams(current);

  assert.equal(next.get("hide-qr-code"), "true");
  assert.equal(next.get("keep-live"), "true");
});

test("keep-live is set once, whatever the current query says", () => {
  const current = new URLSearchParams("keep-live=false&keep-live=true");

  const next = stageScreenSearchParams(current);

  assert.deepEqual(next.getAll("keep-live"), ["true"]);
});

test("the current query is left as it is", () => {
  const current = new URLSearchParams("hide-qr-code=true");

  stageScreenSearchParams(current);

  assert.equal(current.toString(), "hide-qr-code=true");
});
