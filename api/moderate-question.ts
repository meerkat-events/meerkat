/**
 * Decides whether a new question is hidden by automatic moderation
 * (designs/002-question-moderation.md). Fails open: without configuration,
 * without an API key, or when the classifier fails, the question is shown.
 */
import * as Sentry from "@sentry/node";
import { classifyQuestion } from "./classifier.ts";
import env from "./env.ts";
import logger from "./logger.ts";
import type { Conference } from "./models/conferences.ts";
import {
  conferenceModerationSchema,
  decide,
  MODERATION_MODEL,
  MODERATION_TIMEOUT_MS,
  type QuestionModeration,
} from "./moderation.ts";

/** What happened on the call to the classifier, for the per-call log line. */
export type ModerationCall =
  | {
    outcome: "classified";
    durationMs: number;
    usage: { inputTokens: number; cost: number };
  }
  | { outcome: "refused"; durationMs: number; message: string }
  | { outcome: "error"; durationMs: number; error: string };

export type ModerationResult = {
  hiddenAt: Date | null;
  moderation: QuestionModeration | null;
  /** Null when moderation is off for the conference; nothing was called. */
  call: ModerationCall | null;
};

const MODERATION_OFF: ModerationResult = {
  hiddenAt: null,
  moderation: null,
  call: null,
};

// A dead key or an empty balance fails every question; report it to Sentry at
// most this often. Every failure is still logged by logModerationCall.
const SENTRY_REPORT_INTERVAL_MS = 5 * 60 * 1000;
let lastSentryReportAt = 0;

function reportToSentry(error: string) {
  const now = Date.now();
  if (now - lastSentryReportAt >= SENTRY_REPORT_INTERVAL_MS) {
    lastSentryReportAt = now;
    Sentry.captureException(new Error(`Question moderation failed: ${error}`));
  }
}

export async function moderateQuestion(
  { question, talk, conference }: {
    question: string;
    talk: { title: string; speaker: string | null; description: string | null };
    conference: Conference | null;
  },
): Promise<ModerationResult> {
  if (!conference?.moderation || !env.openRouterApiKey) {
    return MODERATION_OFF;
  }

  const config = conferenceModerationSchema.safeParse(conference.moderation);
  if (!config.success) {
    logger.warn(
      { conferenceId: conference.id, error: config.error.message },
      "Invalid conferences.moderation, moderation off for this conference",
    );
    return MODERATION_OFF;
  }

  const started = performance.now();
  const result = await classifyQuestion(
    { question, talk, moderation: config.data },
    {
      apiKey: env.openRouterApiKey,
      model: MODERATION_MODEL,
      timeoutMs: MODERATION_TIMEOUT_MS,
    },
  );
  const durationMs = performance.now() - started;

  if ("error" in result) {
    reportToSentry(result.error);
    return {
      hiddenAt: null,
      moderation: null,
      call: { outcome: "error", durationMs, error: result.error },
    };
  }

  // The model declines to classify only the most harmful questions, so a
  // refusal hides the question instead of failing open.
  if ("refused" in result) {
    return {
      hiddenAt: new Date(),
      moderation: { refused: true, decision: "hide", model: MODERATION_MODEL },
      call: { outcome: "refused", durationMs, message: result.refused },
    };
  }

  const decision = decide(result);
  const moderation: QuestionModeration = {
    category: result.category,
    decision,
    flagged: result.flagged,
    politics: result.politics,
    war: result.war,
    safety: result.safety,
    selfHarm: result.selfHarm,
    ...(result.relevance !== undefined ? { relevance: result.relevance } : {}),
    model: result.model,
    ...(result.id ? { id: result.id } : {}),
  };

  return {
    hiddenAt: decision === "hide" ? new Date() : null,
    moderation,
    call: { outcome: "classified", durationMs, usage: result.usage },
  };
}

/**
 * One structured line per call to the classifier, written after the question
 * is stored so it carries the question's uid. Holds no question text and no
 * user data; the verdict is also stored on the question.
 */
export function logModerationCall(
  { questionUid, eventId, conferenceId, moderation, call }: {
    questionUid: string;
    eventId: number;
    conferenceId: number;
    moderation: QuestionModeration | null;
    call: ModerationCall;
  },
) {
  const fields: Record<string, unknown> = {
    questionUid,
    eventId,
    conferenceId,
    outcome: call.outcome,
    durationMs: Math.round(call.durationMs),
  };

  if (moderation && "category" in moderation) {
    Object.assign(fields, {
      decision: moderation.decision,
      category: moderation.category,
      flagged: moderation.flagged,
      politics: moderation.politics,
      war: moderation.war,
      safety: moderation.safety,
      selfHarm: moderation.selfHarm,
      relevance: moderation.relevance,
      model: moderation.model,
      generationId: moderation.id,
    });
  }
  if (call.outcome === "classified") {
    Object.assign(fields, {
      inputTokens: call.usage.inputTokens,
      cost: call.usage.cost,
    });
  }
  if (call.outcome === "refused") {
    Object.assign(fields, { decision: "hide", refusal: call.message });
  }

  if (call.outcome === "error") {
    logger.warn({ ...fields, error: call.error }, "Question moderation failed, shown");
  } else {
    logger.info(fields, "Question moderation");
  }
}
