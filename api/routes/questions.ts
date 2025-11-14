import { Hono } from "@hono/hono";
import { HTTPException } from "@hono/hono/http-exception";
import { MAX_VOTES_PER_EVENT } from "../moderation.ts";
import { jwt } from "../middlewares/jwt.ts";
import { getEventById } from "../models/events.ts";
import {
  deleteQuestion,
  getQuestionByUID,
  markAsAnswered,
  selectQuestion,
} from "../models/questions.ts";
import { getConferenceRolesForConference } from "../models/roles.ts";
import { getUserById } from "../models/user.ts";
import {
  createVote,
  deleteVote,
  getUserVoteCountAfterDate,
  getVotesByQuestionIdAndUserId,
} from "../models/votes.ts";
import { dateDeductedMinutes } from "../utils/date-deducted-minutes.ts";
import logger from "../logger.ts";

const app = new Hono();

app.post(
  "/api/v1/questions/:uid/upvote",
  jwt(),
  async (c) => {
    const uid = c.req.param("uid");

    const payload = c.get("jwtPayload");

    const [user, question] = await Promise.all([
      getUserById(payload.sub),
      getQuestionByUID(uid),
    ]);

    if (!user) {
      throw new HTTPException(401, {
        message: `User ${payload.sub} not found`,
      });
    }

    if (user.bannedUntil && user.bannedUntil > new Date()) {
      throw new HTTPException(403, { message: `User is blocked` });
    }

    if (!question) {
      throw new HTTPException(404, {
        message: `Question ${uid} not found`,
      });
    }

    const event = await getEventById(question.eventId);

    if (!event) {
      throw new HTTPException(404, {
        message: `Event not found`,
      });
    }

    const minuteAgo = dateDeductedMinutes(1);
    const voteCount = await getUserVoteCountAfterDate(
      user.id,
      event.id,
      minuteAgo,
    );

    if (voteCount >= MAX_VOTES_PER_EVENT) {
      throw new HTTPException(429, { message: "User has too many votes" });
    }

    const hasVoted = await getVotesByQuestionIdAndUserId({
      questionId: question.id,
      userId: user.id,
    });

    if (hasVoted) {
      await deleteVote(question.id, user.id);
    } else {
      await createVote(question.id, user.id);
    }

    const { id: _id, userId: _userId, ...rest } = question;

    logger.info({ question, user, event }, "Upvoted question");

    return c.json({ data: rest });
  },
);

app.post(
  "/api/v1/questions/:uid/select",
  jwt(),
  async (c) => {
    const uid = c.req.param("uid");
    const payload = c.get("jwtPayload");

    const [user, question] = await Promise.all([
      getUserById(payload.sub),
      getQuestionByUID(uid),
    ]);

    if (!user) {
      throw new HTTPException(401, {
        message: `User ${payload.sub} not found`,
      });
    }

    if (!question) {
      throw new HTTPException(404, {
        message: `Question ${uid} not found`,
      });
    }

    const event = await getEventById(question.eventId);

    if (!event) {
      throw new HTTPException(404, {
        message: `Event ${question.eventId} not found`,
      });
    }

    const roles = await getConferenceRolesForConference(
      user.id,
      event.conferenceId,
    );
    const isOrganizer = roles.some((role) => role.role === "organizer");

    if (!isOrganizer) {
      throw new HTTPException(403, { message: `User is not an organizer` });
    }

    const result = await selectQuestion(question.id);

    if (!result) {
      throw new HTTPException(500, { message: `Failed to select question` });
    }
    const { id: _id, userId: _userId, ...rest } = result;

    logger.info({ question, user, event }, "Selected question");

    return c.json({ data: rest });
  },
);

app.post(
  "/api/v1/questions/:uid/mark-as-answered",
  jwt(),
  async (c) => {
    const uid = c.req.param("uid");
    const payload = c.get("jwtPayload");

    const [user, question] = await Promise.all([
      getUserById(payload.sub),
      getQuestionByUID(uid),
    ]);

    if (!user) {
      throw new HTTPException(401, {
        message: `User ${payload.sub} not found`,
      });
    }

    if (!question) {
      throw new HTTPException(404, {
        message: `Question ${uid} not found`,
      });
    }

    const event = await getEventById(question.eventId);

    if (!event) {
      throw new HTTPException(404, {
        message: `Event ${question.eventId} not found`,
      });
    }

    const roles = await getConferenceRolesForConference(
      user.id,
      event.conferenceId,
    );
    const isOrganizer = roles.some((role) => role.role === "organizer");

    if (!isOrganizer) {
      throw new HTTPException(403, { message: `User is not an organizer` });
    }

    const result = await markAsAnswered(question.id);

    if (!result) {
      throw new HTTPException(500, { message: `Failed to mark as answered` });
    }
    const { id: _id, userId: _userId, ...rest } = result;

    logger.info({ question, user, event }, "Marked question as answered");

    return c.json({ data: rest });
  },
);

app.delete(
  "/api/v1/questions/:uid",
  jwt(),
  async (c) => {
    const uid = c.req.param("uid");
    const payload = c.get("jwtPayload");

    const [user, question] = await Promise.all([
      getUserById(payload.sub),
      getQuestionByUID(uid),
    ]);

    if (!user) {
      throw new HTTPException(401, {
        message: `User ${payload.sub} not found`,
      });
    }

    if (!question) {
      throw new HTTPException(404, {
        message: `Question ${uid} not found`,
      });
    }

    const event = await getEventById(question.eventId);

    if (!event) {
      throw new HTTPException(404, {
        message: `Event ${question.eventId} not found`,
      });
    }

    const roles = await getConferenceRolesForConference(
      user.id,
      event.conferenceId,
    );
    const isOrganizer = roles.some((role) => role.role === "organizer");

    if (!isOrganizer) {
      throw new HTTPException(403, { message: `User is not an organizer` });
    }

    const result = await deleteQuestion(question.id);

    if (!result) {
      throw new HTTPException(500, {
        message: `Failed to delete question ${uid}`,
      });
    }
    const { id: _id, userId: _userId, ...rest } = result;

    logger.info({ question, user, event }, "Deleted question");

    return c.json({ data: rest });
  },
);

export default app;
