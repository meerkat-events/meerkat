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
  MODERATION_MODEL,
  MODERATION_TIMEOUT_MS,
  type QuestionModeration,
  shouldHide,
} from "./moderation.ts";

export type ModerationDecision = {
  hiddenAt: Date | null;
  moderation: QuestionModeration | null;
};

const SHOWN_UNCLASSIFIED: ModerationDecision = {
  hiddenAt: null,
  moderation: null,
};

// A dead key or an empty balance fails every question; report it to Sentry at
// most this often. Every failure is still logged.
const SENTRY_REPORT_INTERVAL_MS = 5 * 60 * 1000;
let lastSentryReportAt = 0;

function reportFailure(error: string, conferenceId: number) {
  logger.warn({ error, conferenceId }, "Question moderation failed, shown");

  const now = Date.now();
  if (now - lastSentryReportAt >= SENTRY_REPORT_INTERVAL_MS) {
    lastSentryReportAt = now;
    Sentry.captureException(new Error(`Question moderation failed: ${error}`));
  }
}

export async function moderateQuestion(
  { question, talkTitle, conference }: {
    question: string;
    talkTitle: string;
    conference: Conference | null;
  },
): Promise<ModerationDecision> {
  if (!conference?.moderation || !env.openRouterApiKey) {
    return SHOWN_UNCLASSIFIED;
  }

  const config = conferenceModerationSchema.safeParse(conference.moderation);
  if (!config.success) {
    logger.warn(
      { conferenceId: conference.id, error: config.error.message },
      "Invalid conferences.moderation, moderation off for this conference",
    );
    return SHOWN_UNCLASSIFIED;
  }

  const result = await classifyQuestion(
    { question, talkTitle, moderation: config.data },
    {
      apiKey: env.openRouterApiKey,
      model: MODERATION_MODEL,
      timeoutMs: MODERATION_TIMEOUT_MS,
    },
  );

  if ("error" in result) {
    reportFailure(result.error, conference.id);
    return SHOWN_UNCLASSIFIED;
  }

  const moderation: QuestionModeration = {
    category: result.category,
    flagged: result.flagged,
    politics: result.politics,
    war: result.war,
    model: result.model,
    ...(result.id ? { id: result.id } : {}),
  };

  return {
    hiddenAt: shouldHide(result) ? new Date() : null,
    moderation,
  };
}
