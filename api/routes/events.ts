import { Hono } from "@hono/hono";
import { createMiddleware } from "@hono/hono/factory";
import { HTTPException } from "@hono/hono/http-exception";
import { jwt } from "../middlewares/jwt.ts";
import { zValidator } from "@hono/zod-validator";
import zod from "zod";
import {
  MAX_CHARS_PER_QUESTION,
  MAX_QUESTIONS_PER_EVENT,
  MAX_QUESTIONS_PER_INTERVAL,
  MAX_REACTIONS_PER_INTERVAL,
} from "../moderation.ts";
import env from "../env.ts";
import { type Conference, getConferenceById } from "../models/conferences.ts";
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
  Sort,
  Sorts,
} from "../models/questions.ts";
import {
  createReaction,
  getUserReactionCountAfterDate,
} from "../models/reactions.ts";
import {
  getUserById,
  getUserPostCountAfterDate,
  getUserPostCountPerTalk,
} from "../models/user.ts";
import { dateDeductedMinutes } from "../utils/date-deducted-minutes.ts";
import { Feature, getFeatures } from "../models/features.ts";
import { createAttendancePOD } from "../zupass.ts";
import { getConferenceRolesForConference } from "../models/roles.ts";
import logger from "../logger.ts";
import { generateQRCodePNG } from "../code.ts";
import { supabase } from "../supabase.ts";
import { getStageLiveEvent } from "../models/events.ts";
import { Questions } from "../models/questions.ts";

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
        ...conference,
        features: features.reduce((acc, val) => {
          acc[val.name] = val.active;
          return acc;
        }, {} as Record<string, boolean>),
      },
    },
  });
});

app.get("/api/v1/events/:uid/code", eventMiddleware, async (c) => {
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

const toApiQuestion = (
  { userId: _userId, user, ...rest }: Awaited<
    ReturnType<typeof getQuestions>
  >[number],
) => ({
  ...rest,
  user: user
    ? {
      id: user?.id,
      name: user?.userMetadata?.["name"] ?? user?.id,
    }
    : undefined,
});

app.post(
  "/api/v1/events/:uid/attendance",
  jwt(),
  eventMiddleware,
  async (c) => {
    const event = c.get("event");
    const payload = c.get("jwtPayload");
    const [conference, user] = await Promise.all([
      getConferenceById(event.conferenceId),
      getUserById(payload.sub),
    ]);

    if (!user) {
      throw new HTTPException(401, { message: "User not found" });
    }
    const zupassId = "TODO: Add Zupass ID";

    const pod = createAttendancePOD(conference!, event, zupassId);

    logger.info(
      { pod, conference, event, zupassId, user },
      "Created attendance pod",
    );

    return c.json({
      data: pod.toJSON(),
    });
  },
);

app.get("/api/v1/events/:uid/questions", eventMiddleware, async (c) => {
  const event = c.get("event");
  const sort = c.req.query("sort") ?? "newest";
  const answeredString = c.req.query("answered");
  const answered = typeof answeredString === "string"
    ? answeredString === "true"
    : undefined;

  if (!Sorts.includes(sort as Sort)) {
    throw new HTTPException(400, { message: `Invalid sort ${sort}` });
  }

  const questions = await getQuestions(event.id, sort as Sort, answered);

  return c.json({
    data: questions.map(toApiQuestion),
  });
});

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

    const minuteAgo = dateDeductedMinutes(1);
    const lastMinuteActivityPromise = getUserPostCountAfterDate(
      user.id,
      minuteAgo,
    );
    const talkActivityPromise = getUserPostCountPerTalk(user.id, event.id);
    const [lastMinuteActivity, talkActivity] = await Promise.all([
      lastMinuteActivityPromise,
      talkActivityPromise,
    ]);

    if (
      lastMinuteActivity >= MAX_QUESTIONS_PER_INTERVAL ||
      talkActivity >= MAX_QUESTIONS_PER_EVENT
    ) {
      throw new HTTPException(429, { message: "User has too many posts" });
    }

    const question = await createQuestion({
      question: questionData.question,
      eventId: event.id,
      userId: user.id,
    });

    logger.info({ question, event, user }, "Created question");

    return c.json({
      data: question,
    });
  },
);

const reactionScheme = zod.object({
  uid: zod.string(),
});

app.post(
  "/api/v1/events/:uid/react",
  zValidator("json", reactionScheme),
  jwt(),
  eventMiddleware,
  async (c) => {
    const payload = c.get("jwtPayload");
    const uid = c.req.valid("json").uid;
    const user = await getUserById(payload.sub);
    const event = c.get("event");

    if (!user) {
      throw new HTTPException(401, { message: `User not found` });
    }

    if (user.bannedUntil && user.bannedUntil > new Date()) {
      throw new HTTPException(403, { message: `User is blocked` });
    }

    const thirtySecondsAgo = dateDeductedMinutes(0.5);
    const thirtySecondsActivity = await getUserReactionCountAfterDate(
      user.id,
      thirtySecondsAgo,
    );

    if (thirtySecondsActivity > MAX_REACTIONS_PER_INTERVAL) {
      throw new HTTPException(429, { message: `User has too many reactions` });
    }

    const reaction = await createReaction({
      uid,
      eventId: event.id,
      userId: user.id,
    });

    logger.info({ reaction, event, user }, "Created reaction");

    return c.json({
      data: {
        uid,
        createdAt: reaction.createdAt,
      },
    });
  },
);

app.post(
  "/api/v1/events/:uid/live",
  eventMiddleware,
  jwt(),
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
    const isOrganizer = roles.some((role) => role.role === "organizer");

    if (!isOrganizer) {
      throw new HTTPException(403, { message: `User is not an organizer` });
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

    logger.info({ result, event, user }, "Set event live");

    return c.json({ data: result });
  },
);

app.get(
  "/api/v1/conferences/:id/events",
  async (c) => {
    const conferenceId = parseInt(c.req.param("id"));

    if (Number.isInteger(conferenceId) === false) {
      throw new HTTPException(400, {
        message: `Invalid conference id ${conferenceId}`,
      });
    }

    const conference = await getConferenceById(conferenceId);

    if (!conference) {
      throw new HTTPException(404, {
        message: `Conference with id ${conferenceId} not found`,
      });
    }

    const events = await getEvents({ conferenceId });
    return c.json({ data: events });
  },
);

app.get("/api/v1/events", async (c) => {
  const limit = parseInt(c.req.query("limit") ?? "100");
  const stage = c.req.query("stage");
  const date = c.req.query("date");

  if (isNaN(limit) || limit < 1 || limit > 100) {
    throw new HTTPException(400, {
      message: `Invalid limit ${limit}`,
    });
  }

  const events = await getEvents({ limit, stage, date });
  return c.json({ data: events });
});

app.get("/api/v1/conferences/:id/events/live", async (c) => {
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
      ...conference,
      features: features.reduce((acc, val) => {
        acc[val.name] = val.active;
        return acc;
      }, {} as Record<string, boolean>),
    },
  };
};

export default app;
