import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summarizeModeration, tallyModeration, type VerdictRow } from "./moderation-summary.ts";
import type { QuestionModeration } from "./moderation.ts";

/** A classified verdict with every score at zero unless overridden. */
function verdict(overrides: Partial<QuestionModeration & { refused?: never }>): QuestionModeration {
  return {
    category: "scam",
    decision: "show",
    flagged: 0,
    politics: 0,
    war: 0,
    safety: 0,
    selfHarm: 0,
    model: "test/model",
    ...overrides,
  } as QuestionModeration;
}

const refused: QuestionModeration = { refused: true, decision: "hide", model: "test/model" };

describe("summarizeModeration", () => {
  it("returns null for unclassified questions", () => {
    assert.equal(summarizeModeration(null), null);
  });

  it("lists every score that reached the review threshold, strongest first", () => {
    const summary = summarizeModeration(
      verdict({ category: "shilling", decision: "hide", flagged: 0.6, politics: 0.9, war: 0.1, relevance: 1.5 }),
    );
    assert.deepEqual(summary, {
      decision: "hide",
      reasons: ["politics", "shilling"],
      relevance: 1.5,
    });
  });

  it("leaves out scores below the review threshold", () => {
    const summary = summarizeModeration(verdict({ flagged: 0.29, safety: 0.49 }));
    assert.deepEqual(summary?.reasons, []);
  });

  it("gives a refusal its own reason and no relevance", () => {
    assert.deepEqual(summarizeModeration(refused), {
      decision: "hide",
      reasons: ["refused"],
      relevance: null,
    });
  });
});

describe("tallyModeration", () => {
  const row = (
    eventId: number,
    moderation: QuestionModeration | null,
    state: { hidden?: boolean; deleted?: boolean } = {},
  ): VerdictRow => ({
    eventId,
    moderation,
    hiddenAt: state.hidden ? new Date() : null,
    deletedAt: state.deleted ? new Date() : null,
  });

  it("counts hidden, restored, review and refused questions", () => {
    const { totals } = tallyModeration([
      row(1, verdict({ decision: "hide", flagged: 0.8, category: "scam" }), { hidden: true }),
      row(1, verdict({ decision: "hide", war: 0.9 })), // restored: hide without hiddenAt
      row(2, verdict({ decision: "review", flagged: 0.4 })),
      row(2, refused, { hidden: true }),
      row(2, verdict({ decision: "show", relevance: 3 })),
    ], true);

    assert.equal(totals.enabled, true);
    assert.equal(totals.classified, 5);
    assert.equal(totals.autoHidden, 2);
    assert.equal(totals.restored, 1);
    assert.equal(totals.review, 1);
    assert.equal(totals.refused, 1);
    assert.deepEqual(totals.reasons, { scam: 1, war: 1, refused: 1 });
  });

  it("averages relevance over what attendees saw only", () => {
    const { totals, perEvent } = tallyModeration([
      row(1, verdict({ relevance: 4 })),
      row(1, verdict({ relevance: 2.4 })),
      row(1, verdict({ decision: "hide", flagged: 0.9, relevance: 0 }), { hidden: true }),
      row(1, verdict({ relevance: 0.2 }), { deleted: true }),
      row(1, verdict({})), // classified without a relevance score
    ], false);

    assert.equal(totals.relevance.scored, 2);
    assert.equal(totals.relevance.average, 3.2);
    assert.deepEqual(totals.relevance.distribution, [0, 0, 1, 0, 1]);
    assert.deepEqual(perEvent.get(1), { autoHidden: 1, review: 0, relevanceSum: 6.4, scored: 2 });
  });

  it("skips unclassified questions and has no average without scores", () => {
    const { totals, perEvent } = tallyModeration([row(1, null)], false);
    assert.equal(totals.classified, 0);
    assert.equal(totals.relevance.average, null);
    assert.equal(perEvent.size, 0);
  });
});
