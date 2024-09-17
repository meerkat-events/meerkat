import { Hono } from "@hono/hono";
import { HTTPException } from "@hono/hono/http-exception";
import { jwt } from "@hono/hono/jwt";
import { fromString, getSuffix } from "typeid-js";
import env from "../env.ts";
import { getEventById } from "../models/events.ts";
import { getUserByUID } from "../models/user.ts";
import { getQuestionByUID } from "../models/questions.ts";
import {
  createVote,
  deleteVote,
  getVotesByQuestionIdAndUserId,
} from "../models/votes.ts";
import { SUB_TYPE_ID } from "../utils/jwt.ts";
import { broadcast } from "../realtime.ts";

const app = new Hono();

app.post(
  "/api/v1/questions/:uid/upvote",
  jwt({ secret: env.secret, cookie: "jwt" }),
  async (c) => {
    const uid = c.req.param("uid");

    const payload = c.get("jwtPayload");
    const userUID = fromString(payload.sub as string, SUB_TYPE_ID);

    const [user, question] = await Promise.all([
      getUserByUID(getSuffix(userUID)),
      getQuestionByUID(uid),
    ]);

    if (!user) {
      throw new HTTPException(404, { message: `User ${userUID} not found` });
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

    const hasVoted = await getVotesByQuestionIdAndUserId({
      questionId: question.id,
      userId: user.id,
    });

    if (hasVoted) {
      await deleteVote(question.id, user.id);
    } else {
      await createVote(question.id, user.id);
    }

    broadcast(
      uid,
      { op: "update", type: "question", uid: question.uid },
    );

    const origin = c.req.header("origin") ?? env.base;
    const redirect = new URL(`/events/${event?.uid}/qa`, origin);
    return c.redirect(redirect.toString());
  },
);

export default app;