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
import { getConferenceById } from "../models/conferences.ts";
import {
  getEventByUID,
  getEvents,
  getStageLiveEvent,
  setEventLive,
  setHighEngagement,
} from "../models/events.ts";
import {
  createQuestion,
  getQuestions,
  getRelevanceByQuestion,
  type Sort,
  Sorts,
  toPublicQuestion,
} from "../models/questions.ts";
import {
  createReaction,
  getReactionByUid,
  type Reaction,
  getUserReactionTimesAfterDate,
} from "../models/reactions.ts";
import {
  getUserPostTimesAfterDate,
  getUserPostCountPerTalk,
} from "../models/user.ts";
import {
  requireParticipant,
  requireRole,
} from "../utils/require-participant.ts";
import { conferenceParams } from "../utils/conference-params.ts";
import {
  enforceRateLimit,
  tooManyRequests,
  windowStartSecondsAgo,
} from "../utils/too-many-requests.ts";
import { REACTION_EMOJIS } from "../reactions.ts";
import {
  canModerate,
  getConferenceRolesForConference,
} from "../models/roles.ts";
import logger from "../logger.ts";
import { getPublicEvent, toApiQuestion } from "../models/public-event.ts";
import { hub } from "../realtime/index.ts";
import {
  notifyEventLive,
  notifyQuestionsChanged,
  notifyReaction,
} from "../realtime/notify.ts";
import { eventStream } from "../realtime/sse.ts";

const app = new Hono();

type Env = {
  Variables: {
    event: NonNullable<Awaited<ReturnType<typeof getEventByUID>>>;
  };
};

// Only mounted on routes with a `:uid`, which "/:uid" tells the type checker.
const eventMiddleware = createMiddleware<Env, "/:uid">(async (c, next) => {
  const uid = c.req.param("uid");
  const event = await getEventByUID(uid);

  if (!event) {
    throw new HTTPException(404, { message: `Event ${uid} not found` });
  }

  c.set("event", event);
  await next();
});

// Public: guests (the Q&A page before signing in, the presenter view) and
// embedders read the event and its questions from it.
app.get("/api/v1/events/:uid", eventMiddleware, async (c) => {
  const event = c.get("event");
  const publicEvent = await getPublicEvent(event);

  if (!publicEvent) {
    throw new HTTPException(404, {
      message: `Conference ${event.conferenceId} not found`,
    });
  }

  return c.json({ data: publicEvent });
});

// Public, for guests and embedders (`@meerkat-events/react`). Authentication
// is optional: with a valid token, the viewer's own hidden questions are
// included (automatic moderation hides them from everyone else) and each
// question carries the viewer's `vote` on it, or null. Organizers and
// moderators of the event's conference also get each question's `relevance`
// (0 to 4, or null when unscored), and nothing else of the verdict, for the
// Q&A page's moderation controls.
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
    const [questions, roles] = await Promise.all([
      getQuestions(event.id, sort as Sort, answered, viewerId),
      viewerId
        ? getConferenceRolesForConference(viewerId, event.conferenceId)
        : [],
    ]);

    const relevanceByQuestion = canModerate(roles)
      ? await getRelevanceByQuestion(event.id)
      : null;

    return c.json({
      data: questions.map((question) => ({
        ...toApiQuestion(question),
        // Guests get no `vote` field at all.
        ...(viewerId
          ? {
            vote: question.viewerVoteWeight === null
              ? null
              : { weight: question.viewerVoteWeight },
          }
          : {}),
        ...(relevanceByQuestion
          ? { relevance: relevanceByQuestion.get(question.uid) ?? null }
          : {}),
      })),
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
    const user = await requireParticipant(payload.sub, event.conferenceId);

    const minuteAgo = windowStartSecondsAgo(60);
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

    enforceRateLimit({
      recent: lastMinuteActivity,
      max: MAX_QUESTIONS_PER_INTERVAL,
      windowStart: minuteAgo,
      message: "User has too many posts",
    });

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

    // A question hidden by moderation sends nothing: every stream is public
    // and must not reveal when hidden questions arrive. Its author's page
    // refreshes after posting, and the management pages poll.
    const hidden = question.hiddenAt !== null;
    if (!hidden) {
      void notifyQuestionsChanged(event);
    }

    logger.info(
      {
        questionUid: question.uid,
        question: question.question,
        eventId: event.id,
        userId: user.id,
        hidden,
      },
      "Created question",
    );

    return c.json({
      data: toPublicQuestion(question),
    });
  },
);

// The client picks the uid, a fresh UUID per tap (`useReact`); it is the
// primary key, so it doubles as an idempotency key for resends.
const reactionScheme = zod.object({
  uid: zod.uuid(),
  emoji: zod.enum(REACTION_EMOJIS).default("heart"),
});

/** The fields of a reaction that responses and the event stream carry. */
function toPublicReaction(reaction: Reaction) {
  return {
    uid: reaction.uid,
    emoji: reaction.emoji,
    createdAt: reaction.createdAt.toISOString(),
  };
}

/**
 * What to answer a request whose uid is already stored. The same user
 * reacting in the same event is a resend (the first response got lost on the
 * way), so it gets the stored reaction, which was already counted and
 * published. Any other request reusing the uid is a conflict.
 */
function resentReaction(
  existing: Reaction,
  { userId, eventId }: { userId: string; eventId: number },
) {
  const isResend = existing.userId === userId && existing.eventId === eventId;
  logger.info(
    { reactionUid: existing.uid, eventId, userId, isResend },
    "Reaction uid already exists",
  );
  if (!isResend) {
    throw new HTTPException(409, { message: "Reaction already exists" });
  }
  return toPublicReaction(existing);
}

app.post(
  "/api/v1/events/:uid/react",
  jwt(),
  zValidator("json", reactionScheme),
  eventMiddleware,
  async (c) => {
    const payload = c.get("jwtPayload");
    const { uid, emoji } = c.req.valid("json");
    const event = c.get("event");
    const user = await requireParticipant(payload.sub, event.conferenceId);

    const reactionContext = { userId: user.id, eventId: event.id };

    // Before the rate limit, which counts the stored original: a resend
    // must not end up with a 429 for a reaction that went through.
    const existing = await getReactionByUid(uid);
    if (existing) {
      return c.json({ data: resentReaction(existing, reactionContext) });
    }

    const thirtySecondsAgo = windowStartSecondsAgo(30);
    const thirtySecondsActivity = await getUserReactionTimesAfterDate(
      user.id,
      thirtySecondsAgo,
    );

    enforceRateLimit({
      recent: thirtySecondsActivity,
      max: MAX_REACTIONS_PER_INTERVAL,
      windowStart: thirtySecondsAgo,
      message: "User has too many reactions",
    });

    const reaction = await createReaction({
      uid,
      eventId: event.id,
      userId: user.id,
      emoji,
    });

    // A request with the same uid was inserted between the check above and
    // this insert (a resend while the original was still in flight).
    if (!reaction) {
      const winner = await getReactionByUid(uid);
      if (!winner) {
        throw new HTTPException(409, { message: "Reaction already exists" });
      }
      return c.json({ data: resentReaction(winner, reactionContext) });
    }

    logger.info(
      {
        reactionUid: reaction.uid,
        emoji: reaction.emoji,
        eventId: event.id,
        userId: user.id,
      },
      "Created reaction",
    );

    const publicReaction = toPublicReaction(reaction);
    // Not awaited: reactions come in bursts, and publishing is best effort
    // (notify.ts logs failures), so the response doesn't wait for it.
    void notifyReaction(event, publicReaction);

    return c.json({ data: publicReaction });
  },
);

app.post(
  "/api/v1/events/:uid/live",
  jwt(),
  eventMiddleware,
  async (c) => {
    const event = c.get("event");
    const userId = c.get("jwtPayload").sub;
    await requireRole(userId, event.conferenceId, "moderator");

    const { event: liveEvent, changedEvents } = await setEventLive(event.id);

    void notifyEventLive(liveEvent);
    // The session that ended had its question on stage marked answered.
    for (const changedEvent of changedEvents) {
      void notifyQuestionsChanged(changedEvent);
    }

    logger.info(
      {
        eventId: event.id,
        eventUid: event.uid,
        stage: event.stage,
        userId,
        answeredOnEndEventIds: changedEvents.map((changed) => changed.id),
      },
      "Set event live",
    );

    return c.json({ data: liveEvent });
  },
);

const highEngagementSchema = zod.object({ enabled: zod.boolean() });

// Organizers switch the presenter view's high engagement mode per event. The
// stream's update makes open presenter screens refetch the event and switch.
app.post(
  "/api/v1/events/:uid/high-engagement",
  jwt(),
  eventMiddleware,
  zValidator("json", highEngagementSchema),
  async (c) => {
    const event = c.get("event");
    const { enabled } = c.req.valid("json");
    const userId = c.get("jwtPayload").sub;
    await requireRole(userId, event.conferenceId, "organizer");

    const result = await setHighEngagement(event.id, enabled);
    if (!result) {
      throw new HTTPException(404, { message: `Event ${event.uid} not found` });
    }

    void notifyQuestionsChanged(result);

    logger.info(
      { eventId: event.id, eventUid: event.uid, userId, enabled },
      "Set high engagement mode",
    );

    return c.json({ data: result });
  },
);

// Every session of a conference, for its organizers' schedule and its
// moderators' talk picker.
app.get(
  "/api/v1/conferences/:id/events",
  jwt(),
  zValidator("param", conferenceParams),
  async (c) => {
    const { id: conferenceId } = c.req.valid("param");

    const conference = await getConferenceById(conferenceId);
    if (!conference) {
      throw new HTTPException(404, {
        message: `Conference with id ${conferenceId} not found`,
      });
    }

    await requireRole(c.get("jwtPayload").sub, conferenceId, "moderator");

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

// The Event Card (Zupass attendance PODs) is gone; old links and bookmarks
// land on the session's Q&A page instead.
app.get("/e/:uid/card", (c) => {
  const uid = encodeURIComponent(c.req.param("uid"));
  return c.redirect(new URL(`/e/${uid}/qa`, env.base), 301);
});

// Signage, public: printed QR codes open /stage/:stage/qa, and the stage
// screen (the page /stage/:stage, or /e/:uid?keep-live=true) polls
// /api/v1/events/stage/:stage/live. Both resolve the event the stage shows:
// live, else running, else next, else the one that ended last.
app.get("/stage/:stage/qa", async (c) => {
  const stage = c.req.param("stage");
  const liveEvent = await getStageLiveEvent(stage);

  if (!liveEvent) {
    throw new HTTPException(404, {
      message: `No event found for stage ${stage}`,
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
      message: `No event found for stage ${stage}`,
    });
  }

  return c.json({ data: liveEvent });
});

// Public, like the question list it tells clients to refetch (EventSource
// can't send a token anyway). An unnamed `update` means "refetch the
// questions" (asked, voted, selected, answered, hidden, restored, or a
// resync); a named `reaction` carries one reaction; a named `live` carries
// `{ uid, title }` of the event just put live on this event's stage (same
// conference), so a stage screen can switch to it and the Q&A page can offer
// it. `@meerkat-events/react` 0.1.0 listens to unnamed messages only, so it
// keeps working and never sees the named ones.
app.get(
  "/api/v1/events/:uid/questions/stream",
  eventMiddleware,
  (c) => {
    const event = c.get("event");

    return eventStream(c, (send) =>
      hub.listenToEventStream(event, (message) => {
        switch (message.type) {
          case "reaction":
            send({ event: "reaction", data: JSON.stringify(message.reaction) });
            break;
          case "live":
            send({
              event: "live",
              data: JSON.stringify({
                uid: message.eventUid,
                title: message.title,
              }),
            });
            break;
          case "questions":
          case "resync":
            send({ data: "update" });
            break;
        }
      }));
  },
);

export default app;
