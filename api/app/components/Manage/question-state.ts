import type { Question } from "../../types.ts";

/** Why automatic moderation hid a question or marked it for review. */
export type ModerationReason =
  | "harassment"
  | "hate"
  | "discrimination"
  | "phishing"
  | "scam"
  | "shilling"
  | "politics"
  | "war"
  | "safety"
  | "selfHarm"
  | "refused";

/** The organizer API's summary of an automatic moderation verdict. */
export type Moderation = {
  decision: "hide" | "review" | "show";
  /** Strongest first. */
  reasons: ModerationReason[];
  /** Relevance to the conference, talk and speaker, 0 to 4. */
  relevance: number | null;
};

/**
 * A question as organizers get it: deleted (`deletedAt`, before moderators hid
 * questions instead), hidden by a moderator or automatic moderation
 * (`hiddenAt`), and the verdict when it was classified.
 */
export type ModeratedQuestion = Question & {
  deletedAt?: string | Date | null;
  hiddenAt?: string | Date | null;
  moderation?: Moderation | null;
};

export type QuestionState =
  | "open"
  | "answering"
  | "answered"
  | "hidden"
  | "autoHidden"
  | "restored"
  | "review";

export const REASON_LABELS: Record<ModerationReason, string> = {
  harassment: "Harassment",
  hate: "Hate",
  discrimination: "Discrimination",
  phishing: "Phishing",
  scam: "Scam",
  shilling: "Shilling",
  politics: "Politics",
  war: "War",
  safety: "Threat or private info",
  selfHarm: "Self-harm",
  refused: "Refused by the model",
};

/**
 * The relevance score's five levels, as the model is asked them
 * (buildRelevanceQuestion in api/moderation.ts).
 */
export const RELEVANCE_LEVELS = [
  { name: "Unrelated", means: "nothing to do with the conference, talk or speaker" },
  { name: "Loosely related", means: "the conference's subject, not this talk" },
  { name: "Related", means: "the talk's general topic" },
  { name: "Highly relevant", means: "specific to this talk or the speaker's work" },
  { name: "Excellent", means: "a specific, thoughtful question for this speaker" },
] as const;

/** The index of the level a score is closest to, e.g. 2.6 → 3. */
export function relevanceIndex(score: number) {
  return Math.min(RELEVANCE_LEVELS.length - 1, Math.max(0, Math.round(score)));
}

/** The level a score is closest to, e.g. 2.6 → "Highly relevant". */
export function relevanceLevel(score: number) {
  return RELEVANCE_LEVELS[relevanceIndex(score)]?.name ?? "";
}

/** The reasons as one readable line, e.g. "Scam, Shilling". */
export function reasonText(moderation: Moderation | null | undefined) {
  return (moderation?.reasons ?? []).map((reason) => REASON_LABELS[reason]).join(", ");
}

/**
 * Hidden questions (by a moderator or by automatic moderation) and deleted
 * ones are not on the Q&A; every other question is open, on stage or
 * answered, and may be marked for review on top. A hidden question whose
 * verdict is "hide" is automatic moderation's; any other was a moderator's.
 * A visible one whose verdict is "hide" was restored by an organizer.
 */
export function questionStates(q: ModeratedQuestion): QuestionState[] {
  const states: QuestionState[] = [];
  const hiddenByModeration = !!q.hiddenAt && q.moderation?.decision === "hide";
  if (hiddenByModeration) states.push("autoHidden");
  else if (q.deletedAt || q.hiddenAt) states.push("hidden");
  if (!q.deletedAt && !q.hiddenAt) {
    if (q.answeredAt) states.push("answered");
    else if (q.selectedAt) states.push("answering");
    else states.push("open");
    if (q.moderation?.decision === "hide") states.push("restored");
    if (q.moderation?.decision === "review") states.push("review");
  }
  return states;
}

export const FILTERS = [
  { value: "all", label: "All" },
  { value: "answered", label: "Answered" },
  { value: "hidden", label: "Hidden" },
  { value: "autoHidden", label: "Auto-hidden" },
  { value: "review", label: "Review" },
] as const;

export type Filter = (typeof FILTERS)[number]["value"];

export function matchesFilter(q: ModeratedQuestion, filter: Filter) {
  if (filter === "all") return true;
  return questionStates(q).includes(filter);
}

export const SORTS = [
  { label: "Newest", value: "newest" },
  { label: "Most votes", value: "votes" },
  { label: "Most relevant", value: "relevance" },
] as const;

export type Sort = (typeof SORTS)[number]["value"];

const newestFirst = (a: ModeratedQuestion, b: ModeratedQuestion) =>
  +new Date(b.createdAt) - +new Date(a.createdAt);

/**
 * Newest: a straight ticker. Most votes: highest first, answered last (as in
 * the Q&A). Most relevant: moderation's relevance score, unscored last.
 */
export function sortQuestions<T extends ModeratedQuestion>(questions: T[], sort: Sort): T[] {
  const compare = sort === "votes"
    ? (a: T, b: T) =>
      Number(!!a.answeredAt) - Number(!!b.answeredAt) ||
      b.votes - a.votes ||
      newestFirst(a, b)
    : sort === "relevance"
    ? (a: T, b: T) =>
      (b.moderation?.relevance ?? -1) - (a.moderation?.relevance ?? -1) ||
      newestFirst(a, b)
    : newestFirst;
  return [...questions].sort(compare);
}
