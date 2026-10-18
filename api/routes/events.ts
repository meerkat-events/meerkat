import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { jwt, optionalJwt } from "../middlewares/jwt.ts";
import { logModerationCall, moderateQuestion } from "../moderate-question.ts";
import { zValidator } from "@hono/zod-validator";
import zod from "zod";
import {
  MAX_CHARS_PER_QUESTION,
  MAX_QUESTIONS_PER_EVENT,
  MAX_QUESTIONS_PER_INTERVAL,
  MAX_REACTIONS_PER_INTERVAL,
} from "../moderation.ts";
import env from "../env.ts";
import {
  type Conference,
  getConferenceById,
  toApiConference,
} from "../models/conferences.ts";
import {
  countParticipants,
  type Event,
  getEventByUID,
  getEvents,
  getLiveEvent,
  setEventLive,
} from "../models/events.ts";
import {
  createQuestion,
  getQuestions,
  getSelectedQuestion,
  type Sort,
  Sorts,
  toPublicQuestion,
} from "../models/questions.ts";
import {
  createReaction,
  getUserReactionTimesAfterDate,
} from "../models/reactions.ts";
import {
  getUserById,
  getUserPostTimesAfterDate,
  getUserPostCountPerTalk,
} from "../models/user.ts";
import { dateDeductedMinutes } from "../utils/date-deducted-minutes.ts";
import { tooManyRequests } from "../utils/too-many-requests.ts";
import { REACTION_EMOJIS } from "../reactions.ts";
import { ATTENDEES_ONLY_MESSAGE } from "../features.ts";
import { type Feature, getFeatures } from "../models/features.ts";
import {
  canModerate,
  getConferenceRolesForConference,
  mayParticipate,
} from "../models/roles.ts";
import logger from "../logger.ts";
import { generateQRCodePNG } from "../code.ts";
import { supabase } from "../supabase.ts";
import { getStageLiveEvent } from "../models/events.ts";
import type { Questions } from "../models/questions.ts";
import { streamSSE } from "hono/streaming";
import {
  broadcastQuestionsUpdate,
  subscribeToEventQuestions,
} from "../utils/broadcast.ts";

const app = new Hono();

type Env = {
  Variables: {
    event: NonNullable<Awaited<ReturnType<typeof getEventByUID>>>;
  };
};

const eventMiddleware = createMiddleware<Env>(async (c, next) => {
  const uid = c.req.param("uid");
  if (!uid) {
    throw new HTTPException(400, { message: `Event UID is required` });
  }
  const event = await getEventByUID(uid);

  if (!event) {
    throw new HTTPException(404, { message: `Event ${uid} not found` });
  }

  c.set("event", event);
  await next();
});

// Public: the layouts load it for theming, and guests (the Q&A page before
// signing in, the presenter view) read the event and its questions from it.
app.get("/api/v1/events/:uid", eventMiddleware, async (c) => {
  const event = c.get("event");

  const [conference, questions, participants, features] = await Promise.all([
    getConferenceById(event.conferenceId),
    // By default, we exclude the answered questions
    getQuestions(event.id, "popular", false),
    countParticipants(event.id),
    getFeatures(event.conferenceId),
  ]);

  if (!conference) {
    throw new HTTPException(404, {
      message: `Conference ${event.conferenceId} not found`,
    });
  }

  const votes = questions.reduce((acc, question) => acc + question.votes, 0);

  return c.json({
    data: {
      ...event,
      questions: questions.map(toApiQuestion),
      votes,
      participants,
      conference: {
        ...toApiConference(conference),
        features: features.reduce((acc, val) => {
          acc[val.name] = val.active;
          return acc;
        }, {} as Record<string, boolean>),
      },
    },
  });
});

// The session's Q&A link as a PNG QR code. The app draws its QR codes in the
// browser; this is for signed-in API clients.
app.get("/api/v1/events/:uid/code", jwt(), eventMiddleware, async (c) => {
  const widthInput = Number.parseInt(c.req.query("width") ?? "512");

  if (isNaN(widthInput)) {
    throw new HTTPException(400, { message: "Invalid width" });
  }
  if (widthInput < 128 || widthInput > 2048) {
    throw new HTTPException(400, {
      message: "Invalid width, must be between 128 and 2048",
    });
  }

  const event = c.get("event");

  const url = new URL(`/e/${event.uid}/qa`, env.base);

  return c.body(await generateQRCodePNG(url.toString(), widthInput), 200, {
    "Content-Type": "image/png",
  });
});

// The viewer's vote is left out here: only the Q&A page's own list, fetched
// with a token, gets it (see the questions route).
const toApiQuestion = (
  { userId: _userId, user, viewerVoteWeight: _viewerVoteWeight, ...rest }:
    Awaited<ReturnType<typeof getQuestions>>[number],
) => ({
  ...rest,
  user: user
    ? {
      id: user?.id,
      name: user?.userMetadata?.["name"] ?? user?.id,
    }
    : undefined,
});

// Public, for guests and embedders (`@meerkat-events/react`). Authentication
// is optional: with a valid token, the viewer's own hidden questions are
// included (automatic moderation hides them from everyone else) and each
// question carries the viewer's `vote` on it, or null.
app.get(
  "/api/v1/events/:uid/questions",
  optionalJwt(),
  eventMiddleware,
  async (c) => {
    const event = c.get("event");
    const sort = c.req.query("sort") ?? "newest";
    const answeredString = c.req.query("answered");
    const answered = typeof answeredString === "string"
      ? answeredString === "true"
      : undefined;

    if (!Sorts.includes(sort as Sort)) {
      throw new HTTPException(400, { message: `Invalid sort ${sort}` });
    }

    const payloadSub = c.get("jwtPayload")?.sub;
    const viewerId = typeof payloadSub === "string" ? payloadSub : undefined;
    const questions = await getQuestions(
      event.id,
      sort as Sort,
      answered,
      viewerId,
    );

    if (!viewerId) {
      return c.json({ data: questions.map(toApiQuestion) });
    }

    return c.json({
      data: questions.map((question) => ({
        ...toApiQuestion(question),
        vote: question.viewerVoteWeight === null
          ? null
          : { weight: question.viewerVoteWeight },
      })),
    });
  },
);

app.get(
  "/api/v1/events/:uid/questions/selected",
  jwt(),
  eventMiddleware,
  async (c) => {
    const event = c.get("event");
    const question = await getSelectedQuestion(event.id);

    return c.json({
      data: question ? toApiQuestion(question) : null,
    });
  },
);

const createQuestionSchema = zod.object({
  question: zod.string().max(MAX_CHARS_PER_QUESTION).min(1),
});

app.post(
  "/api/v1/events/:uid/questions",
  jwt(),
  eventMiddleware,
  zValidator("json", createQuestionSchema),
  async (c) => {
    const questionData = c.req.valid("json");
    const event = c.get("event");
    const payload = c.get("jwtPayload");
    const uid = payload.sub as string;
    const user = await getUserById(uid);

    if (!user) {
      throw new HTTPException(401, { message: `User ${uid} not found` });
    }

    if (user.bannedUntil && user.bannedUntil > new Date()) {
      throw new HTTPException(403, { message: `User ${uid} is blocked` });
    }

    if (!await mayParticipate(user.id, event.conferenceId)) {
      throw new HTTPException(403, { message: ATTENDEES_ONLY_MESSAGE });
    }

    const minuteAgo = dateDeductedMinutes(1);
    const lastMinuteActivityPromise = getUserPostTimesAfterDate(
      user.id,
      minuteAgo,
    );
    const talkActivityPromise = getUserPostCountPerTalk(user.id, event.id);
    const [lastMinuteActivity, talkActivity, conference] = await Promise.all([
      lastMinuteActivityPromise,
      talkActivityPromise,
      getConferenceById(event.conferenceId),
    ]);

    // The session cap first: it doesn't lift, so a countdown would mislead.
    if (talkActivity >= MAX_QUESTIONS_PER_EVENT) {
      throw tooManyRequests("User has too many posts");
    }

    if (lastMinuteActivity.length >= MAX_QUESTIONS_PER_INTERVAL) {
      throw tooManyRequests("User has too many posts", {
        recent: lastMinuteActivity,
        allowed: MAX_QUESTIONS_PER_INTERVAL - 1,
        windowStart: minuteAgo,
      });
    }

    const { hiddenAt, moderation, call } = await moderateQuestion({
      question: questionData.question,
      talk: {
        title: event.title,
        speaker: event.speaker,
        description: event.description,
      },
      conference,
    });

    const question = await createQuestion({
      question: questionData.question,
      eventId: event.id,
      userId: user.id,
      hiddenAt,
      moderation,
    });

    if (call) {
      logModerationCall({
        questionUid: question.uid,
        eventId: event.id,
        conferenceId: event.conferenceId,
        moderation,
        call,
      });
    }

    // A hidden question changes no one else's list, so there is nothing to
    // broadcast; its author's page refreshes after posting.
    if (question.hiddenAt) {
      logger.info(
        {
          questionUid: question.uid,
          question: question.question,
          eventId: event.id,
          userId: user.id,
        },
        "Created question, hidden by moderation",
      );
    } else {
      broadcastQuestionsUpdate(event.id);
      logger.info(
        {
          questionUid: question.uid,
          question: question.question,
          eventId: event.id,
          userId: user.id,
        },
        "Created question",
      );
    }

    return c.json({
      data: toPublicQuestion(question),
    });
  },
);

const reactionScheme = zod.object({
  uid: zod.string(),
  emoji: zod.enum(REACTION_EMOJIS).default("heart"),
});

app.post(
  "/api/v1/events/:uid/react",
  jwt(),
  zValidator("json", reactionScheme),
  eventMiddleware,
  async (c) => {
    const payload = c.get("jwtPayload");
    const { uid, emoji } = c.req.valid("json");
    const user = await getUserById(payload.sub);
    const event = c.get("event");

    if (!user) {
      throw new HTTPException(401, { message: `User not found` });
    }

    if (user.bannedUntil && user.bannedUntil > new Date()) {
      throw new HTTPException(403, { message: `User is blocked` });
    }

    if (!await mayParticipate(user.id, event.conferenceId)) {
      throw new HTTPException(403, { message: ATTENDEES_ONLY_MESSAGE });
    }

    const thirtySecondsAgo = dateDeductedMinutes(0.5);
    const thirtySecondsActivity = await getUserReactionTimesAfterDate(
      user.id,
      thirtySecondsAgo,
    );

    if (thirtySecondsActivity.length > MAX_REACTIONS_PER_INTERVAL) {
      throw tooManyRequests("User has too many reactions", {
        recent: thirtySecondsActivity,
        allowed: MAX_REACTIONS_PER_INTERVAL,
        windowStart: thirtySecondsAgo,
      });
    }

    const reaction = await createReaction({
      uid,
      eventId: event.id,
      userId: user.id,
      emoji,
    });

    logger.info(
      {
        reactionUid: reaction.uid,
        emoji: reaction.emoji,
        eventId: event.id,
        userId: user.id,
      },
      "Created reaction",
    );

    return c.json({
      data: {
        uid,
        emoji: reaction.emoji,
        createdAt: reaction.createdAt,
      },
    });
  },
);

app.post(
  "/api/v1/events/:uid/live",
  jwt(),
  eventMiddleware,
  async (c) => {
    const event = c.get("event");
    const payload = c.get("jwtPayload");
    const user = await getUserById(payload.sub);

    if (!user) {
      throw new HTTPException(401, { message: "User not found" });
    }

    const roles = await getConferenceRolesForConference(
      user.id,
      event.conferenceId,
    );
    if (!canModerate(roles)) {
      throw new HTTPException(403, { message: `User is not a moderator` });
    }

    const result = await setEventLive(event.id);

    if (!result) {
      throw new HTTPException(500, { message: `Failed to set event live` });
    }

    if (supabase) {
      const channel = supabase.channel(`conference-${event.conferenceId}`);

      await channel.send({
        "type": "broadcast",
        "event": "live",
        "data": {
          "eventId": event.id,
          "eventUid": event.uid,
        },
      });

      const channelTwo = supabase.channel(`stage-${event.stage}`);

      await channelTwo.send({
        "type": "broadcast",
        "event": "live",
        "data": {
          "event": event,
        },
      });
    }

    logger.info(
      {
        eventId: event.id,
        eventUid: event.uid,
        stage: event.stage,
        userId: user.id,
      },
      "Set event live",
    );

    return c.json({ data: result });
  },
);

// Every session of a conference, for its organizers' schedule and its
// moderators' talk picker.
app.get(
  "/api/v1/conferences/:id/events",
  jwt(),
  async (c) => {
    const conferenceId = parseInt(c.req.param("id"));

    if (Number.isInteger(conferenceId) === false) {
      throw new HTTPException(400, {
        message: `Invalid conference id ${conferenceId}`,
      });
    }

    const [conference, roles] = await Promise.all([
      getConferenceById(conferenceId),
      getConferenceRolesForConference(c.get("jwtPayload").sub, conferenceId),
    ]);

    if (!conference) {
      throw new HTTPException(404, {
        message: `Conference with id ${conferenceId} not found`,
      });
    }

    if (!canModerate(roles)) {
      throw new HTTPException(403, { message: `User is not a moderator` });
    }

    const limit = parseInt(c.req.query("limit") ?? "100");
    if (isNaN(limit) || limit < 1 || limit > 1000) {
      throw new HTTPException(400, {
        message: `Invalid limit ${limit}, must be between 1 and 1000`,
      });
    }

    const events = await getEvents({ conferenceId, limit });
    return c.json({ data: events });
  },
);

// Public: the Q&A page's session switcher lists a stage's sessions for
// guests too.
app.get("/api/v1/events", async (c) => {
  const limit = parseInt(c.req.query("limit") ?? "100");
  const stage = c.req.query("stage");
  const date = c.req.query("date");

  if (isNaN(limit) || limit < 1 || limit > 100) {
    throw new HTTPException(400, {
      message: `Invalid limit ${limit}`,
    });
  }

  const events = await getEvents({
    limit,
    ...(stage ? { stage } : {}),
    ...(date ? { date } : {}),
  });
  return c.json({ data: events });
});

app.get("/api/v1/conferences/:id/events/live", jwt(), async (c) => {
  const conferenceId = parseInt(c.req.param("id"));
  if (Number.isInteger(conferenceId) === false) {
    throw new HTTPException(400, {
      message: `Invalid conference id ${conferenceId}`,
    });
  }

  const [conference, liveEvent, features] = await Promise.all([
    getConferenceById(conferenceId),
    getLiveEvent(conferenceId),
    getFeatures(conferenceId),
  ]);

  if (!conference) {
    throw new HTTPException(404, {
      message: `Conference with id ${conferenceId} not found`,
    });
  }

  if (!liveEvent) {
    throw new HTTPException(404, {
      message: `No live event found for conference ${conferenceId}`,
    });
  }

  const [questions, participants] = await Promise.all([
    getQuestions(liveEvent.id, "popular", false),
    countParticipants(liveEvent.id),
  ]);

  return c.json({
    data: toFullApiEvent({
      event: liveEvent,
      features,
      questions,
      conference,
      participants,
    }),
  });
});

// Signage, public: the stage screen and printed QR codes open these, and the
// presenter view polls /api/v1/events/stage/:stage/live (useKeepLive).
// The Event Card (Zupass attendance PODs) is gone; old links and bookmarks
// land on the session's Q&A page instead.
app.get("/e/:uid/card", (c) => {
  const uid = encodeURIComponent(c.req.param("uid"));
  return c.redirect(new URL(`/e/${uid}/qa`, env.base), 301);
});

app.get("/stage/:stage", async (c) => {
  const stage = c.req.param("stage");
  const liveEvent = await getStageLiveEvent(stage);

  if (!liveEvent) {
    throw new HTTPException(404, {
      message: `No live event found for stage ${stage}`,
    });
  }

  const url = new URL(`/e/${liveEvent.uid}`, env.base);
  url.searchParams.append("keep-live", "true");

  return c.redirect(url);
});

app.get("/stage/:stage/qa", async (c) => {
  const stage = c.req.param("stage");
  const liveEvent = await getStageLiveEvent(stage);

  if (!liveEvent) {
    throw new HTTPException(404, {
      message: `No live event found for stage ${stage}`,
    });
  }

  const url = new URL(`/e/${liveEvent.uid}/qa`, env.base);

  return c.redirect(url);
});

app.get("/api/v1/events/stage/:stage/live", async (c) => {
  const stage = c.req.param("stage");
  const liveEvent = await getStageLiveEvent(stage);

  if (!liveEvent) {
    throw new HTTPException(404, {
      message: `No live event found for stage ${stage}`,
    });
  }

  return c.json({ data: liveEvent });
});

const toFullApiEvent = (
  { event, features, questions, conference, participants }: {
    event: Event;
    features: Feature[];
    questions: Questions;
    conference: Conference;
    participants: number;
  },
) => {
  return {
    ...event,
    questions: questions.map(toApiQuestion),
    votes: questions.reduce((acc, question) => acc + question.votes, 0),
    participants,
    conference: {
      ...toApiConference(conference),
      features: features.reduce((acc, val) => {
        acc[val.name] = val.active;
        return acc;
      }, {} as Record<string, boolean>),
    },
  };
};

const MIN_RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 7000;

/** A random SSE `retry:` delay, so reconnects don't all arrive at once. */
function reconnectDelayMs(): number {
  const spread = MAX_RECONNECT_DELAY_MS - MIN_RECONNECT_DELAY_MS;
  return MIN_RECONNECT_DELAY_MS + Math.floor(Math.random() * spread);
}

// Public, like the question list it tells clients to refetch (EventSource
// can't send a token anyway).
app.get(
  "/api/v1/events/:uid/questions/stream",
  eventMiddleware,
  async (c) => {
    if (!supabase) {
      throw new HTTPException(503, { message: "Realtime unavailable" });
    }

    const event = c.get("event");

    return streamSSE(c, async (stream) => {
      // A "ping" carrying the reconnection delay: clients ignore pings, and
      // after a restart they come back spread over a few seconds instead of
      // all in the same one.
      await stream.writeSSE({ data: "ping", retry: reconnectDelayMs() });

      // writeSSE swallows write errors, so this promise never rejects.
      const unsubscribe = subscribeToEventQuestions(event.id, () => {
        void stream.writeSSE({ data: "update" });
      });

      stream.onAbort(unsubscribe);

      while (!stream.closed) {
        await stream.sleep(30_000);
        if (!stream.closed) await stream.writeSSE({ data: "ping" });
      }

      unsubscribe();
    });
  },
);

export default app;
