import { z } from "zod";
import { Hono } from "@hono/hono";
import { jwt, sign } from "@hono/hono/jwt";
import env from "../env.ts";
import { constructJWTPayload } from "../utils/jwt.ts";
import { COOKIE_NAME, COOKIE_OPTIONS, setJWTCookie } from "../utils/cookie.ts";
import {
  countAnsweredQuestions,
  countQuestions,
  countReactions,
  countReceivedVotes,
  countVotes,
  getUserByProvider,
  getUserByUID,
  getUserContributionRank,
  updateUserEmail,
  ZUPASS_PROVIDER,
} from "../models/user.ts";
import { HTTPException } from "@hono/hono/http-exception";
import { getVotesByUserId } from "../models/votes.ts";
import { zValidator } from "@hono/zod-validator";
import { deleteCookie } from "@hono/hono/cookie";
import { createUserFromAccount, markUserAsBlocked } from "../models/user.ts";
import {
  getConferenceRoles,
  getConferenceRolesForConference,
  grantRole,
} from "../models/roles.ts";
import { getConferenceByTicket } from "../models/conferences.ts";
import { hash } from "../utils/secret.ts";
import logger from "../logger.ts";

const app = new Hono();

app.get(
  "/api/v1/users/me",
  jwt({ secret: env.secret, cookie: COOKIE_NAME }),
  async (c) => {
    const payload = c.get("jwtPayload");
    const user = await getUserByUID(payload.sub);

    if (!user) {
      throw new HTTPException(401, { message: `User not found` });
    }

    if (user.blocked) {
      throw new HTTPException(403, { message: `User is blocked` });
    }

    const rankAndPoints = await getUserContributionRank(user.id);

    const { id: _id, blocked: _blocked, ...rest } = user;

    return c.json({
      data: { ...rest, ...rankAndPoints },
    });
  },
);

app.get(
  "/api/v1/users/me/votes",
  jwt({ secret: env.secret, cookie: COOKIE_NAME }),
  async (c) => {
    const payload = c.get("jwtPayload");
    const user = await getUserByUID(payload.sub);

    if (!user) {
      throw new HTTPException(401, { message: `User not found` });
    }

    const votes = await getVotesByUserId(user.id);
    const apiVotes = votes.map((vote) => ({
      questionUid: vote.question.uid,
      userUid: user.uid,
      createdAt: vote.createdAt,
    }));

    return c.json({ data: apiVotes });
  },
);

app.get(
  "/api/v1/users/me/roles",
  jwt({ secret: env.secret, cookie: COOKIE_NAME }),
  async (c) => {
    const payload = c.get("jwtPayload");
    const user = await getUserByUID(payload.sub);
    if (!user) {
      throw new HTTPException(401, { message: `User not found` });
    }

    const conferenceRoles = await getConferenceRoles(user.id);
    const apiRoles = conferenceRoles.map(({ userId: _userId, ...rest }) =>
      rest
    );

    return c.json({
      data: apiRoles,
    });
  },
);

app.get(
  "/api/v1/users/me/stats",
  jwt({ secret: env.secret, cookie: COOKIE_NAME }),
  async (c) => {
    const payload = c.get("jwtPayload");
    const user = await getUserByUID(payload.sub);
    if (!user) {
      throw new HTTPException(401, { message: `User not found` });
    }

    const [votes, questions, answeredQuestions, reactions, receivedVotes] =
      await Promise.all([
        countVotes(user.id),
        countQuestions(user.id),
        countAnsweredQuestions(user.id),
        countReactions(user.id),
        countReceivedVotes(user.id),
      ]);

    return c.json({
      data: {
        votes,
        questions,
        answeredQuestions,
        reactions,
        receivedVotes,
      },
    });
  },
);

// TODO: Use correct ticket proof scheme
const proofScheme = z.any();
const ROLE_HIERARCHY = ["attendee", "speaker", "organizer"];

app.post(
  "/api/v1/users/prove",
  zValidator("json", proofScheme),
  async (c) => {
    const ticketProof = c.req.valid("json");

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

    const email = ticketProof.revealedClaims.pods.ticket.entries.attendeeEmail;

    const result = await getConferenceByTicket(
      eventId,
      signerPublicKey,
      productId,
    );

    if (!result) {
      throw new HTTPException(400, { message: "Ticket not found" });
    }

    let user = await getUserByProvider(ZUPASS_PROVIDER, publicKey);
    const hashValue = email ? await hash(env.emailSecret, email) : null;

    if (!user) {
      user = await createUserFromAccount({
        provider: ZUPASS_PROVIDER,
        id: publicKey,
        hash: hashValue,
      });
    } else if (hashValue) {
      await updateUserEmail(user.id, hashValue);
    }

    const conferenceRoles = await getConferenceRolesForConference(
      user.id,
      result.conference_tickets.conferenceId,
    );

    const conference = result.conferences;
    const role = result.conference_tickets.role;

    const newRoleIndex = ROLE_HIERARCHY.indexOf(role);
    const currentRoleIndex = conferenceRoles.reduce((acc, role) => {
      return Math.max(acc, ROLE_HIERARCHY.indexOf(role.role));
    }, -1);

    const isNewRole = newRoleIndex > currentRoleIndex;
    if (isNewRole) {
      await grantRole(user.id, conference.id, role);
    }

    const payload = constructJWTPayload(user);
    const jwtString = await sign(payload, env.secret);
    setJWTCookie(c, jwtString);

    logger.info(
      { user, pod: ticketProof, conference, role, isNewRole },
      "Signed in with ticket proof",
    );

    return c.json({ data: { user } });
  },
);

app.post(
  "/api/v1/users/:uid/block",
  jwt({ secret: env.secret, cookie: COOKIE_NAME }),
  async (c) => {
    const uid = c.req.param("uid");

    const payload = c.get("jwtPayload");

    const user = await getUserByUID(payload.sub);
    const blockedUser = await getUserByUID(uid);

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

app.post("/api/v1/users/logout", (c) => {
  deleteCookie(c, COOKIE_NAME, COOKIE_OPTIONS);

  return c.json({ data: {} });
});

export default app;
