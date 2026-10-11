import { Hono } from "hono";
import { jwt } from "../middlewares/jwt.ts";
import { getUserById } from "../models/user.ts";
import { HTTPException } from "hono/http-exception";
import {
  getSupervoteBalance,
  SUPERVOTE_WEIGHT,
} from "../models/supervotes.ts";
import { markUserAsBlocked } from "../models/user.ts";
import { canModerate, getConferenceRoles } from "../models/roles.ts";
import logger from "../logger.ts";

const app = new Hono();

// Supervotes the user can spend, in any conference with the `supervotes`
// feature on, and how much a supervoted upvote weighs.
app.get(
  "/api/v1/users/me/supervotes",
  jwt(),
  async (c) => {
    const payload = c.get("jwtPayload");
    const available = await getSupervoteBalance(payload.sub);

    return c.json({ data: { available, weight: SUPERVOTE_WEIGHT } });
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

    // Moderators of any conference can block (a global ban), like organizers.
    const roles = await getConferenceRoles(user.id);

    if (!canModerate(roles)) {
      throw new HTTPException(403, { message: `User is not a moderator` });
    }

    if (!blockedUser) {
      throw new HTTPException(404, {
        message: `Blocked User ${uid} not found`,
      });
    }

    await markUserAsBlocked(blockedUser.id);

    logger.info(
      { userId: user.id, blockedUserId: blockedUser.id },
      "Blocked user",
    );

    return c.json({ data: {} });
  },
);

export default app;
