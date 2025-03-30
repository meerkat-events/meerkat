import { Hono } from "@hono/hono";
import { createMiddleware } from "@hono/hono/factory";
import { HTTPException } from "@hono/hono/http-exception";
import { jwt } from "@hono/hono/jwt";
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
  countParticipants,
  createEventPod,
  getEventByUID,
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
  getAccounts,
  getUserByUID,
  getUserPostCountAfterDate,
  getUserPostCountPerTalk,
  ZUPASS_PROVIDER,
} from "../models/user.ts";
import { dateDeductedMinutes } from "../utils/date-deducted-minutes.ts";
import { getFeatures } from "../models/features.ts";
import { createAttendancePOD } from "../zupass.ts";
import { getConferenceRolesForConference } from "../models/roles.ts";
import { bodyLimit } from "@hono/hono/body-limit";
import { checkEventEnded } from "./errors.ts";
import { COOKIE_NAME } from "../utils/cookie.ts";

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
    getQuestions(event.id),
    countParticipants(event.id),
    getFeatures(event.conferenceId),
  ]);

  if (!conference) {
    throw new HTTPException(404, {
      message: `Conference ${event.conferenceId} not found`,
    });
  }

  const votes = questions.reduce((acc, question) => acc + question.votes, 0);

  const { secret: _secret, ...rest } = event;

  return c.json({
    data: {
      ...rest,
      questions: questions.map(toApiQuestion),
      votes,
      participants,
      conference,
      features: features.reduce((acc, val) => {
        acc[val.name] = val.active;
        return acc;
      }, {} as Record<string, boolean>),
    },
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
      uid: user?.uid,
      name: user?.name ?? undefined,
    }
    : undefined,
});

const attendanceSchema = zod.object({
  secret: zod.string(),
});

app.post(
  "/api/v1/events/:uid/attendance",
  jwt({ secret: env.secret, cookie: COOKIE_NAME }),
  zValidator("json", attendanceSchema),
  eventMiddleware,
  async (c) => {
    const secret = c.req.valid("json").secret;
    const event = c.get("event");
    const payload = c.get("jwtPayload");
    const [conference, user] = await Promise.all([
      getConferenceById(event.conferenceId),
      getUserByUID(payload.sub),
    ]);

    if (!user) {
      throw new HTTPException(401, { message: "User not found" });
    }

    if (event.secret && event.secret !== secret) {
      throw new HTTPException(401, {
        message: `Secret ${secret} is invalid for event ${event.uid}`,
      });
    }

    const roles = await getConferenceRolesForConference(
      user.id,
      event.conferenceId,
    );

    if (roles.length === 0) {
      throw new HTTPException(403, { message: "User has no conference roles" });
    }

    const zupassAccount = await getAccounts(user.id);
    const zupassId = zupassAccount?.find((a) => a.provider === ZUPASS_PROVIDER)
      ?.id;

    if (!zupassId) {
      throw new HTTPException(400, {
        message: `User ${user.uid} does not have a Zupass account`,
      });
    }

    const pod = createAttendancePOD(conference!, event, zupassId);

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
  jwt({ secret: env.secret, cookie: COOKIE_NAME }),
  eventMiddleware,
  zValidator("json", createQuestionSchema),
  async (c) => {
    const questionData = c.req.valid("json");
    const event = c.get("event");
    const payload = c.get("jwtPayload");
    const uid = payload.sub as string;
    const user = await getUserByUID(uid);

    if (!user) {
      throw new HTTPException(401, { message: `User ${uid} not found` });
    }

    if (user.blocked) {
      throw new HTTPException(403, { message: `User ${uid} is blocked` });
    }

    const conferenceRoles = await getConferenceRolesForConference(
      user.id,
      event.conferenceId,
    );

    if (conferenceRoles.length === 0) {
      throw new HTTPException(403, {
        message: `User ${uid} has no conference roles`,
      });
    }

    checkEventEnded(event);

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
  jwt({ secret: env.secret, cookie: COOKIE_NAME }),
  eventMiddleware,
  async (c) => {
    const payload = c.get("jwtPayload");
    const uid = c.req.valid("json").uid;
    const user = await getUserByUID(payload.sub);
    const event = c.get("event");

    if (!user) {
      throw new HTTPException(401, { message: `User not found` });
    }

    if (user.blocked) {
      throw new HTTPException(403, { message: `User is blocked` });
    }

    const conferenceRoles = await getConferenceRolesForConference(
      user.id,
      event.conferenceId,
    );

    if (conferenceRoles.length === 0) {
      throw new HTTPException(403, { message: "User has no conference roles" });
    }

    checkEventEnded(event);

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

    return c.json({
      data: {
        uid,
        createdAt: reaction.createdAt,
      },
    });
  },
);

const feedbackSchema = zod.object({
  entries: zod.record(zod.string(), zod.any()),
  signature: zod.string(),
  signerPublicKey: zod.string(),
});

app.post(
  "/api/v1/events/:uid/feedback",
  eventMiddleware,
  bodyLimit({
    maxSize: 100 * 1024,
  }),
  jwt({ secret: env.secret, cookie: COOKIE_NAME }),
  zValidator("json", feedbackSchema),
  async (c) => {
    const event = c.get("event");
    const payload = c.get("jwtPayload");
    const user = await getUserByUID(payload.sub);
    const pod = c.req.valid("json");

    if (!user) {
      throw new HTTPException(401, { message: "User not found" });
    }

    const createdPod = await createEventPod({
      eventId: event.id,
      userId: user.id,
      pod,
    });

    return c.json({
      data: createdPod,
    });
  },
);

export default app;
