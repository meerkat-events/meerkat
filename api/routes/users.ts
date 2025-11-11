import { z } from "zod";
import { Hono } from "@hono/hono";
import { jwt } from "../middlewares/jwt.ts";
import env from "../env.ts";
import { getUserById, updateProfile } from "../models/user.ts";
import { HTTPException } from "@hono/hono/http-exception";
import { getVotesByUserId } from "../models/votes.ts";
import { zValidator } from "@hono/zod-validator";
import { markUserAsBlocked } from "../models/user.ts";
import { getConferenceRoles } from "../models/roles.ts";
import { getConferenceByTicket } from "../models/conferences.ts";
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

// TODO: Use correct ticket proof scheme
const proofScheme = z.any();

app.post(
  "/api/v1/users/prove",
  jwt(),
  zValidator("json", proofScheme),
  async (c) => {
    const ticketProof = c.req.valid("json");
    const payload = c.get("jwtPayload");
    const userId = payload.sub;

    if (!userId) {
      throw new HTTPException(401, { message: "User not found" });
    }

    const user = await getUserById(userId);

    if (!user) {
      throw new HTTPException(401, { message: "User not found" });
    }

    const response = await fetch(`${env.verifierEndpoint}/verify`, {
      body: JSON.stringify(ticketProof),
      method: "POST",
    });

    if (!response.ok) {
      throw new HTTPException(500, { message: "Failed to verify proof" });
    }

    const body = await response.json();

    if (!body.data.verified) {
      throw new HTTPException(400, { message: "Prove is invalid" });
    }

    const signerPublicKey = ticketProof.revealedClaims.pods.ticket
      .signerPublicKey as string;
    const eventId = ticketProof.revealedClaims.pods.ticket.entries
      .eventId as string;
    const productId = ticketProof.revealedClaims.pods.ticket.entries
      .productId as string;
    const publicKey =
      ticketProof.revealedClaims.pods.ticket.entries.owner.eddsa_pubkey;

    const result = await getConferenceByTicket(
      eventId,
      signerPublicKey,
      productId,
    );

    if (!result) {
      throw new HTTPException(400, { message: "Ticket not found" });
    }

    const conference = result.conferences;
    const role = result.conference_tickets.role;

    await updateProfile(userId, {
      userId,
      name: userId,
      zupassId: publicKey,
    });

    logger.info(
      { user, pod: ticketProof, conference, role },
      "User proved ticket",
    );

    return c.json({ data: { user } });
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
