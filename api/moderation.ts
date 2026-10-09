import zod from "zod";

// Rate limits.
export const MAX_QUESTIONS_PER_INTERVAL = 3;
export const MAX_QUESTIONS_PER_EVENT = 10;
export const MAX_CHARS_PER_QUESTION = 200;
export const MAX_REACTIONS_PER_INTERVAL = 50;
export const MAX_VOTES_PER_EVENT = 3;

// Automatic question moderation (designs/002-question-moderation.md). Every
// change to the model, the criteria or the threshold must pass the eval in
// scripts/moderation-eval.ts.

/** Pinned snapshot, so behavior only changes together with a passing eval. */
export const MODERATION_MODEL = "openai/gpt-6-luna-decisions-20261006";

/** p95 latency is about 0.3 s; slower calls fail open. */
export const MODERATION_TIMEOUT_MS = 1500;

/**
 * A question is hidden when the probability that it is not "none" reaches
 * this value. 0.6 hid no kept question in 5,640 real ones.
 */
export const HIDE_THRESHOLD = 0.6;

/** Options of the classification question; "none" first on purpose. */
export const MODERATION_CATEGORIES = [
  "none",
  "harassment",
  "hate",
  "discrimination",
  "phishing",
  "scam",
  "shilling",
] as const;

export type ModerationCategory = (typeof MODERATION_CATEGORIES)[number];
export type HarmfulCategory = Exclude<ModerationCategory, "none">;

export const DEFAULT_INSTRUCTIONS =
  `Classify this audience question from a conference Q&A session. Questions are
short (at most 200 characters), typed on phones, often informal, and may be in
any language. Almost all questions belong in "none". Use the conference
context and the talk to judge what is on topic.`;

export const DEFAULT_CRITERIA: Record<ModerationCategory, string> = {
  none:
    "Any ordinary question or comment: blunt or critical questions about the talk, the speaker's work or the ecosystem; jokes and memes; feedback, thanks and compliments; questions about tokens, prices or launches related to the talk; political or controversial topics without hate; tests, duplicates and off-topic remarks.",
  harassment:
    "Insults, sexual remarks or advances, or personal attacks aimed at a speaker, attendee or named person, including about looks, body or relationships.",
  hate:
    "Slurs or hostile, dehumanizing statements about people because of ethnicity, nationality, religion, gender, sexuality, disability or similar.",
  discrimination:
    "Calls to exclude people or treat them worse because of such group membership.",
  phishing:
    "Attempts to get people to open a link, scan a code, connect a wallet, or share a seed phrase or credentials.",
  scam:
    "Promises of money, prizes, airdrops or rewards in return for an action such as upvoting, sending funds or signing up; impersonation; vote buying.",
  shilling:
    "Promotion of a token, ticker, product, project, referral code or link that is unrelated to the talk, including calls to buy or pump.",
};

const nonEmptyText = zod.string().trim().min(1);

/**
 * `conferences.moderation`: null means the conference is not moderated.
 * Overrides can only replace the text of known options, never remove "none"
 * or add an option.
 */
export const conferenceModerationSchema = zod.strictObject({
  context: nonEmptyText,
  instructions: nonEmptyText.optional(),
  criteria: zod.strictObject({
    none: nonEmptyText.optional(),
    harassment: nonEmptyText.optional(),
    hate: nonEmptyText.optional(),
    discrimination: nonEmptyText.optional(),
    phishing: nonEmptyText.optional(),
    scam: nonEmptyText.optional(),
    shilling: nonEmptyText.optional(),
  }).optional(),
});

export type ConferenceModeration = zod.infer<typeof conferenceModerationSchema>;

/** `questions.moderation`: the verdict stored with a classified question. */
export type QuestionModeration = {
  /** Most likely harmful option, even when the question was not hidden. */
  category: HarmfulCategory;
  /** Probability that the question is not "none". */
  flagged: number;
  /** Dated model snapshot that answered. */
  model: string;
  /** OpenRouter generation id, when the response carried one. */
  id?: string;
};
