import { Hono } from "hono";
import { jwt } from "../middlewares/jwt.ts";
import { getUserById } from "../models/user.ts";
import { HTTPException } from "hono/http-exception";
import { getVotesByUserId } from "../models/votes.ts";
import { markUserAsBlocked } from "../models/user.ts";
import { getConferenceRoles } from "../models/roles.ts";
import logger from "../logger.ts";

const app = new Hono();

app.get(
  "/api/v1/users/me/votes",
  jwt(),
  async (c) => {
    const payload = c.get("jwtPayload");
    const user = await getUserById(payload.sub);

    if (!user) {
      throw new HTTPException(401, { message: `User not found` });
    }

    const votes = await getVotesByUserId(user.id);
    const apiVotes = votes.map((vote) => ({
      questionUid: vote.question.uid,
      userId: user.id,
      createdAt: vote.createdAt,
    }));

    return c.json({ data: apiVotes });
  },
);

app.get(
  "/api/v1/users/me/roles",
  jwt(),
  async (c) => {
    const payload = c.get("jwtPayload");
    const user = await getUserById(payload.sub);
    if (!user) {
      throw new HTTPException(401, { message: `User not found` });
    }

    const conferenceRoles = await getConferenceRoles(user.id);

    return c.json({
      data: conferenceRoles,
    });
  },
);

app.post(
  "/api/v1/users/:uid/block",
  jwt(),
  async (c) => {
    const uid = c.req.param("uid");

    const payload = c.get("jwtPayload");

    const user = await getUserById(payload.sub);
    const blockedUser = await getUserById(uid);

    if (!user) {
      throw new HTTPException(404, {
        message: `User ${payload.sub} not found`,
      });
    }

    const roles = await getConferenceRoles(user.id);
    const isSomeOrganizer = roles.some((r) => r.role == "organizer");

    if (!isSomeOrganizer) {
      throw new HTTPException(403, { message: `User is not an organizer` });
    }

    if (!blockedUser) {
      throw new HTTPException(404, {
        message: `Blocked User ${uid} not found`,
      });
    }

    await markUserAsBlocked(blockedUser.id);

    logger.info({ user, blockedUser }, "Blocked user");

    return c.json({ data: {} });
  },
);

export default app;
