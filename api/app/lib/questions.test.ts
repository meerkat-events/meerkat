import assert from "node:assert/strict";
import { test } from "node:test";
import { isAnswering, pinAnswering } from "./questions.ts";

const now = new Date();

test("isAnswering is true only for a selected question not yet answered", () => {
  assert.equal(isAnswering({ selectedAt: now }), true);
  assert.equal(isAnswering({ selectedAt: now, answeredAt: now }), false);
  assert.equal(isAnswering({ answeredAt: now }), false);
  assert.equal(isAnswering({}), false);
});

test("pinAnswering moves the answering question first and keeps the rest in order", () => {
  const questions = [
    { id: 1 },
    { id: 2, selectedAt: now, answeredAt: now },
    { id: 3, selectedAt: now },
    { id: 4 },
  ];

  assert.deepEqual(pinAnswering(questions).map(({ id }) => id), [3, 1, 2, 4]);
});

test("pinAnswering keeps the order when nothing is being answered", () => {
  const questions: { id: number; selectedAt?: Date }[] = [{ id: 1 }, { id: 2 }];

  assert.deepEqual(pinAnswering(questions), questions);
});
