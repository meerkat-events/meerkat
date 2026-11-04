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
  getLiveEvent,
  setEventLive,
  setHighEngagement,
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
  getReactionByUid,
  type Reaction,
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
import {
  canModerate,
  getConferenceRolesForConference,
  isOrganizer,
  mayParticipate,
} from "../models/roles.ts";
import logger from "../logger.ts";
import { generateQRCodePNG } from "../code.ts";
import { getStageLiveEvent } from "../models/events.ts";
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

    // A question hidden by moderation sends nothing: every stream is public
    // and must not reveal when hidden questions arrive. Its author's page
    // refreshes after posting, and the management pages poll.
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
      void notifyQuestionsChanged(event);
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

    const reactionContext = { userId: user.id, eventId: event.id };

    // Before the rate limit, which counts the stored original: a resend
    // must not end up with a 429 for a reaction that went through.
    const existing = await getReactionByUid(uid);
    if (existing) {
      return c.json({ data: resentReaction(existing, reactionContext) });
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

    void notifyEventLive(result);

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

    const roles = await getConferenceRolesForConference(
      userId,
      event.conferenceId,
    );
    if (!isOrganizer(roles)) {
      throw new HTTPException(403, { message: `User is not an organizer` });
    }

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

  const liveEvent = await getLiveEvent(conferenceId);
  const publicEvent = liveEvent ? await getPublicEvent(liveEvent) : null;

  if (!publicEvent) {
    throw new HTTPException(404, {
      message: `No event found for conference ${conferenceId}`,
    });
  }

  return c.json({ data: publicEvent });
});

// Signage, public: printed QR codes open /stage/:stage/qa, and the stage
// screen (the page /stage/:stage, or /e/:uid?keep-live=true) polls
// /api/v1/events/stage/:stage/live. Both resolve the event the stage shows:
// live, else running, else next, else the one that ended last.
// The Event Card (Zupass attendance PODs) is gone; old links and bookmarks
// land on the session's Q&A page instead.
app.get("/e/:uid/card", (c) => {
  const uid = encodeURIComponent(c.req.param("uid"));
  return c.redirect(new URL(`/e/${uid}/qa`, env.base), 301);
});

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
// questions" (asked, voted, selected, answered, deleted, restored, or a
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
