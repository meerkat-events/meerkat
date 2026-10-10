/**
 * Classifies an audience question with OpenRouter's Decisions API
 * (designs/002-question-moderation.md). Configuration comes in as parameters
 * so the module imports neither env.ts nor db.ts and runs in tests and the
 * eval script without a full environment.
 */
import zod from "zod";
import {
  buildRelevanceQuestion,
  type ConferenceModeration,
  DEFAULT_CRITERIA,
  DEFAULT_INSTRUCTIONS,
  type HarmfulCategory,
  MODERATION_CATEGORIES,
  type ModerationCategory,
  type ModerationScores,
  POLITICS_QUESTION,
  SAFETY_QUESTION,
  SELF_HARM_QUESTION,
  WAR_QUESTION,
} from "./moderation.ts";

const DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions";

export type ClassifierInput = {
  question: string;
  talk: { title: string; speaker: string | null; description: string | null };
  moderation: ConferenceModeration;
};

export type ClassifierConfig = {
  apiKey: string;
  model: string;
  timeoutMs: number;
};

export type Classification = ModerationScores & {
  /** Most likely option other than "none". */
  category: HarmfulCategory;
  /** Dated model snapshot that answered. */
  model: string;
  /** OpenRouter generation id, when the response carried one. */
  id?: string;
  /** Relevance to conference, topic and speaker, 0 to 4, when answered. */
  relevance?: number;
  usage: { inputTokens: number; cost: number };
};

/**
 * A classification; a refusal, when the model declined to classify the
 * question (callers hide it); or an error (callers fail open).
 */
export type ClassificationResult =
  | Classification
  | { refused: string }
  | { error: string };

const noulAnswerSchema = zod.object({
  type: zod.literal("noul"),
  noul: zod.number().min(0).max(1),
});

const decisionsResponseSchema = zod.object({
  id: zod.string().optional(),
  model: zod.string(),
  answers: zod.object({
    category: zod.object({
      type: zod.literal("choice"),
      probabilities: zod.record(zod.string(), zod.number().min(0).max(1)),
    }),
    politics: noulAnswerSchema,
    war: noulAnswerSchema,
    safety: noulAnswerSchema,
    self_harm: noulAnswerSchema,
    relevance: zod.object({
      type: zod.literal("score"),
      score: zod.number().min(0).max(4),
    }).optional(),
  }),
  usage: zod.object({
    input_tokens: zod.number(),
    cost: zod.number().optional(),
  }),
});

/**
 * The Decisions request for one question. Only the conference's written
 * context, the talk title and the question are sent: speaker names and talk
 * descriptions made the results worse in the eval. The questions are answered
 * independently, so the yes/no questions leave the category probabilities
 * unchanged.
 */
export function buildDecisionsRequest(input: ClassifierInput, model: string) {
  const criteria: Record<ModerationCategory, string> = { ...DEFAULT_CRITERIA };
  for (const category of MODERATION_CATEGORIES) {
    const override = input.moderation.criteria?.[category];
    if (override) {
      criteria[category] = override;
    }
  }

  return {
    model,
    state: {
      conference: input.moderation.context,
      talk: { title: input.talk.title },
      question: input.question,
    },
    questions: {
      category: {
        type: "choice",
        instructions: input.moderation.instructions ?? DEFAULT_INSTRUCTIONS,
        criteria,
      },
      politics: POLITICS_QUESTION,
      war: WAR_QUESTION,
      safety: SAFETY_QUESTION,
      self_harm: SELF_HARM_QUESTION,
      relevance: buildRelevanceQuestion(input.talk),
    },
  };
}

export async function classifyQuestion(
  input: ClassifierInput,
  config: ClassifierConfig,
): Promise<ClassificationResult> {
  let response: Response;
  try {
    response = await fetch(DECISIONS_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildDecisionsRequest(input, config.model)),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (error) {
    return { error: `Request failed: ${describeError(error)}` };
  }

  if (!response.ok) {
    const refusal = await readRefusal(response);
    return refusal ? { refused: refusal } : { error: `HTTP ${response.status}` };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    return { error: `Invalid JSON: ${describeError(error)}` };
  }

  const parsed = decisionsResponseSchema.safeParse(body);
  if (!parsed.success) {
    return { error: `Unexpected response: ${parsed.error.message}` };
  }

  const probabilities = parsed.data.answers.category.probabilities;
  const missing = MODERATION_CATEGORIES.filter((option) =>
    probabilities[option] === undefined
  );
  if (missing.length > 0) {
    return { error: `Missing probabilities for ${missing.join(", ")}` };
  }

  return {
    category: mostLikelyHarmfulCategory(probabilities),
    flagged: 1 - probabilities["none"]!,
    politics: parsed.data.answers.politics.noul,
    war: parsed.data.answers.war.noul,
    safety: parsed.data.answers.safety.noul,
    selfHarm: parsed.data.answers.self_harm.noul,
    ...(parsed.data.answers.relevance
      ? { relevance: parsed.data.answers.relevance.score }
      : {}),
    model: parsed.data.model,
    ...(parsed.data.id ? { id: parsed.data.id } : {}),
    usage: {
      inputTokens: parsed.data.usage.input_tokens,
      cost: parsed.data.usage.cost ?? 0,
    },
  };
}

/**
 * The harmful option with the highest probability. Not the API's `choice`,
 * which can be "none" while the harmful options together outweigh it.
 */
function mostLikelyHarmfulCategory(
  probabilities: Record<string, number>,
): HarmfulCategory {
  let best: HarmfulCategory = "harassment";
  for (const category of MODERATION_CATEGORIES) {
    if (category === "none") continue;
    if (probabilities[category]! > probabilities[best]!) {
      best = category;
    }
  }
  return best;
}

/**
 * The provider's message when it refused to answer, as OpenRouter reports it
 * (HTTP 502, "OpenAI refused to answer question ..."); null for other errors.
 * It refuses the most harmful questions, which therefore must not fail open.
 */
async function readRefusal(response: Response): Promise<string | null> {
  try {
    const body = await response.json() as { error?: { message?: unknown } };
    const message = body.error?.message;
    return typeof message === "string" && /refused to answer/i.test(message)
      ? message
      : null;
  } catch {
    return null;
  }
}

function describeError(error: unknown) {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
