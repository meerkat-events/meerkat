/**
 * What organizers see of automatic moderation (moderation.ts): a summary of
 * each stored verdict, and the totals across a conference. Pure functions, no
 * database access, so they can be tested on their own.
 */
import {
  type HarmfulCategory,
  MODERATION_THRESHOLDS,
  type ModerationDecision,
  type QuestionModeration,
} from "./moderation.ts";

/** Why moderation hid a question or marked it for review. */
export type ModerationReason =
  | HarmfulCategory
  | "politics"
  | "war"
  | "safety"
  | "selfHarm"
  | "refused";

/** What organizers see of a verdict: no raw scores, no model details. */
export type ModerationSummary = {
  decision: ModerationDecision;
  /** Every score that reached the review threshold, strongest first. */
  reasons: ModerationReason[];
  /** Relevance to the conference, talk and speaker, 0 to 4. */
  relevance: number | null;
};

export function summarizeModeration(
  moderation: QuestionModeration | null,
): ModerationSummary | null {
  if (!moderation) return null;
  if ("refused" in moderation) {
    return { decision: "hide", reasons: ["refused"], relevance: null };
  }

  const { review } = MODERATION_THRESHOLDS;
  const scores: { reason: ModerationReason; score: number; threshold: number }[] = [
    { reason: moderation.category, score: moderation.flagged, threshold: review.category },
    { reason: "politics", score: moderation.politics, threshold: review.yesNo },
    { reason: "war", score: moderation.war, threshold: review.yesNo },
    { reason: "safety", score: moderation.safety, threshold: review.yesNo },
    { reason: "selfHarm", score: moderation.selfHarm, threshold: review.yesNo },
  ];
  const reasons = scores
    .filter(({ score, threshold }) => score >= threshold)
    .sort((a, b) => b.score - a.score)
    .map(({ reason }) => reason);

  return {
    decision: moderation.decision,
    reasons,
    relevance: moderation.relevance ?? null,
  };
}

/** What automatic moderation did across a conference. */
export type ModerationTotals = {
  /** Whether the conference has a moderation config. */
  enabled: boolean;
  /** Questions with a verdict (moderation on, classifier answered). */
  classified: number;
  autoHidden: number;
  /** Hidden by moderation, then shown again by an organizer. */
  restored: number;
  review: number;
  /** The model declined to classify; such questions are hidden. */
  refused: number;
  /** Hidden questions (including restored ones) per reason. */
  reasons: Partial<Record<ModerationReason, number>>;
  relevance: {
    /** Average over the questions attendees saw. */
    average: number | null;
    /** How many of those had a relevance score. */
    scored: number;
    /** How many scored about 0, 1, 2, 3 and 4. */
    distribution: [number, number, number, number, number];
  };
};

export type VerdictRow = {
  eventId: number;
  hiddenAt: Date | null;
  deletedAt: Date | null;
  moderation: QuestionModeration | null;
};

/**
 * Tallies the verdicts stored on a conference's questions, per session and
 * in total.
 */
export function tallyModeration(rows: VerdictRow[], enabled: boolean) {
  const totals: ModerationTotals = {
    enabled,
    classified: 0,
    autoHidden: 0,
    restored: 0,
    review: 0,
    refused: 0,
    reasons: {},
    relevance: { average: null, scored: 0, distribution: [0, 0, 0, 0, 0] },
  };
  const perEvent = new Map<
    number,
    { autoHidden: number; review: number; relevanceSum: number; scored: number }
  >();
  let relevanceSum = 0;

  for (const row of rows) {
    const summary = summarizeModeration(row.moderation);
    if (!summary) continue;

    let event = perEvent.get(row.eventId);
    if (!event) {
      event = { autoHidden: 0, review: 0, relevanceSum: 0, scored: 0 };
      perEvent.set(row.eventId, event);
    }

    totals.classified++;
    if (summary.reasons.includes("refused")) totals.refused++;
    if (summary.decision === "review") {
      totals.review++;
      event.review++;
    }
    if (summary.decision === "hide") {
      if (row.hiddenAt) {
        totals.autoHidden++;
        event.autoHidden++;
      } else {
        totals.restored++;
      }
      for (const reason of summary.reasons) {
        totals.reasons[reason] = (totals.reasons[reason] ?? 0) + 1;
      }
    }

    const seenByAttendees = !row.hiddenAt && !row.deletedAt;
    if (seenByAttendees && summary.relevance !== null) {
      relevanceSum += summary.relevance;
      totals.relevance.scored++;
      const bucket = Math.min(4, Math.round(summary.relevance));
      totals.relevance.distribution[bucket] = (totals.relevance.distribution[bucket] ?? 0) + 1;
      event.relevanceSum += summary.relevance;
      event.scored++;
    }
  }

  if (totals.relevance.scored > 0) {
    totals.relevance.average = relevanceSum / totals.relevance.scored;
  }

  return { totals, perEvent };
}
