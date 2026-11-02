import assert from "node:assert/strict";
import { test } from "node:test";
import { isAnswering, splitAnswering } from "./questions.ts";

const now = new Date();

test("isAnswering is true only for a selected question not yet answered", () => {
  assert.equal(isAnswering({ selectedAt: now }), true);
  assert.equal(isAnswering({ selectedAt: now, answeredAt: now }), false);
  assert.equal(isAnswering({ answeredAt: now }), false);
  assert.equal(isAnswering({}), false);
});

test("splitAnswering takes out the answering question and keeps the rest in order", () => {
  const questions = [
    { id: 1 },
    { id: 2, selectedAt: now, answeredAt: now },
    { id: 3, selectedAt: now },
    { id: 4 },
  ];

  const { answering, others } = splitAnswering(questions);

  assert.equal(answering?.id, 3);
  assert.deepEqual(others.map(({ id }) => id), [1, 2, 4]);
});

test("splitAnswering picks the latest selected when two are answering", () => {
  const questions = [
    { id: 1, selectedAt: "2026-11-02T10:00:00.000Z" },
    { id: 2, selectedAt: "2026-11-02T10:05:00.000Z" },
  ];

  const { answering, others } = splitAnswering(questions);

  assert.equal(answering?.id, 2);
  assert.deepEqual(others.map(({ id }) => id), [1]);
});
