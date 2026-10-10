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
 * Probabilities at which a question is hidden, or marked for an organizer to
 * review (stored only until the admin view exists). `category` applies to the
 * probability that the question is not "none", `yesNo` to each yes/no
 * question below. Calibrated on the labeled eval sets: at 0.5 the category
 * hides 12 of 15 real violations and no kept question.
 */
export const MODERATION_THRESHOLDS = {
  hide: { category: 0.5, yesNo: 0.7 },
  review: { category: 0.3, yesNo: 0.5 },
};

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
    "Insults, sexual remarks or advances, or personal attacks aimed at a speaker, attendee or named person, including insults about their looks, body or relationships. Compliments are not harassment.",
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

/**
 * Politics that has nothing to do with crypto, outside talks about politics.
 * A separate yes/no question rather than another category option, so it does
 * not shift the probabilities of the categories above.
 */
export const POLITICS_QUESTION = {
  type: "noul",
  instructions:
    "Does this audience question bring politics into a talk where it does not belong: party politics, elections, politicians, governments, wars or armed conflicts that have nothing to do with crypto or blockchains and nothing to do with the topic of the talk?",
  criteria: {
    true:
      "Opinions or debates about elections, parties, politicians, governments, wars, armed conflicts, genocide, immigration or other political controversies, with no link to crypto or blockchains, asked in a talk whose topic is not politics or society. Framing it as a question about ethics does not change this.",
    false:
      "Anything else: questions about the talk, technology, privacy tools, careers, business, travel or life; law, regulation, taxes or policy related to crypto, blockchains or the talk's topic; political questions in a talk that is itself about politics, geopolitics, governance or society; jokes and banter.",
  },
} as const;

/** Current wars, armed conflicts and genocide, which never fit a talk here. */
export const WAR_QUESTION = {
  type: "noul",
  instructions:
    "Does this audience question bring up a current war, armed conflict or genocide?",
  criteria: {
    true:
      "Raises, debates or takes sides in an ongoing or recent war, armed conflict or genocide, or refers to its victims, in any talk and in any framing, including ethics or charity.",
    false:
      "Anything else, including historical wars used as an analogy, security exercises or 'war room' simulations, cyberattacks and hacks, and questions about using crypto or blockchains to help people affected by a conflict.",
  },
} as const;

/**
 * Threats, doxxing and explicit content. Asked separately for the same reason
 * as politics: adding them to the harassment text lowered other categories.
 */
export const SAFETY_QUESTION = {
  type: "noul",
  instructions:
    "Does this audience question threaten someone, expose a third person's private information, or contain explicit sexual content?",
  criteria: {
    true:
      "Threats or calls for violence against anyone, including implied threats such as saying you know where someone lives; sharing or demanding a third person's private information such as a phone number, home address or the real identity behind someone else's anonymous account (doxxing); explicit sexual content or propositions.",
    false:
      "Anything else, including violence, privacy, anonymity or doxxing as a topic or technical challenge; asking speakers to reveal their own accounts or asking to be de-anonymized yourself; jokes without a target; flirting or compliments without explicit content.",
  },
} as const;

const MAX_TALK_DESCRIPTION_LENGTH = 500;

/**
 * How relevant a question is to the conference, the talk's topic and its
 * speaker, on a scale from 0 (unrelated) to 4 (excellent). Stored only: it neither
 * hides questions nor reaches any client yet. Speaker and description go into
 * this question's instructions, not the shared state, because in the shared
 * state they made the category answers worse.
 */
export function buildRelevanceQuestion(
  talk: { speaker: string | null; description: string | null },
) {
  const instructions = [
    "How relevant is this audience question to the conference, the talk's topic and its speaker?",
  ];
  if (talk.speaker) {
    instructions.push(`Speaker: ${talk.speaker}.`);
  }
  if (talk.description) {
    instructions.push(
      `About the talk: ${talk.description.slice(0, MAX_TALK_DESCRIPTION_LENGTH)}`,
    );
  }

  return {
    type: "score",
    instructions: instructions.join("\n"),
    criteria: [
      "Unrelated: nothing to do with the conference, the talk or the speaker, such as tests, chatter or personal requests.",
      "Loosely related: about the conference's broader subject, but not this talk or speaker.",
      "Related: about the talk's general topic.",
      "Highly relevant: specific to this talk or the speaker's work.",
      "Excellent: a specific, thoughtful question this speaker is well placed to answer and the audience will learn from.",
    ],
  } as const;
}

/** Self-harm, a category every moderation taxonomy covers. */
export const SELF_HARM_QUESTION = {
  type: "noul",
  instructions:
    "Does this audience question express an intent to harm oneself or encourage someone else to?",
  criteria: {
    true:
      "Says the writer intends to hurt or kill themselves, or urges or instructs anyone to self-harm or commit suicide.",
    false:
      "Anything else, including burnout, stress or mental health discussed as a topic, figures of speech, and dark jokes that are not directed at anyone.",
  },
} as const;

/** The scores a hiding decision is based on. */
export type ModerationScores = {
  /** Probability that the question is not "none". */
  flagged: number;
  /** Probability of "yes" to POLITICS_QUESTION. */
  politics: number;
  /** Probability of "yes" to WAR_QUESTION. */
  war: number;
  /** Probability of "yes" to SAFETY_QUESTION. */
  safety: number;
  /** Probability of "yes" to SELF_HARM_QUESTION. */
  selfHarm: number;
};

export type ModerationDecision = "hide" | "review" | "show";

export function decide(
  scores: ModerationScores,
  thresholds = MODERATION_THRESHOLDS,
): ModerationDecision {
  const reaches = (level: { category: number; yesNo: number }) =>
    scores.flagged >= level.category ||
    scores.politics >= level.yesNo ||
    scores.war >= level.yesNo ||
    scores.safety >= level.yesNo ||
    scores.selfHarm >= level.yesNo;

  if (reaches(thresholds.hide)) return "hide";
  if (reaches(thresholds.review)) return "review";
  return "show";
}

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

/**
 * `questions.moderation`: the verdict stored with a classified question, or
 * the record that the model refused to classify it (the question is hidden).
 */
export type QuestionModeration =
  | ModerationScores & {
    /** Most likely harmful option, even when the question was not hidden. */
    category: HarmfulCategory;
    decision: ModerationDecision;
    /** Relevance to conference, topic and speaker, 0 to 4; not exposed yet. */
    relevance?: number;
    /** Dated model snapshot that answered. */
    model: string;
    /** OpenRouter generation id, when the response carried one. */
    id?: string;
  }
  | { refused: true; decision: "hide"; model: string };
