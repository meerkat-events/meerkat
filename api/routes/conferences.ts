import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import zod from "zod";
import env from "../env.ts";
import {
  getConferenceById,
  getConferences,
  toApiConference,
} from "../models/conferences.ts";
import { HTTPException } from "hono/http-exception";
import { getLiveEvent } from "../models/events.ts";
import { jwt } from "../middlewares/jwt.ts";
import { getUserById } from "../models/user.ts";
import { getConferenceRolesForConference } from "../models/roles.ts";
import {
  type ConferenceQuestions,
  getConferenceQuestions,
  getConferenceStats,
  getConferenceUserActivity,
} from "../models/conference-activity.ts";

const app = new Hono();

app.get("/api/v1/conferences", async (c) => {
  const conferences = await getConferences();
  return c.json({ data: conferences.map(toApiConference) });
});

app.get("/api/v1/conferences/:id/live", async (c) => {
  const conferenceId = parseInt(c.req.param("id"));
  if (Number.isInteger(conferenceId) === false) {
    throw new HTTPException(400, {
      message: `Invalid conference id ${conferenceId}`,
    });
  }

  const liveEvent = await getLiveEvent(conferenceId);

  if (!liveEvent) {
    throw new HTTPException(404, {
      message: `No live event found for conference ${conferenceId}`,
    });
  }

  return c.redirect(new URL(`/e/${liveEvent.uid}/qa`, env.base));
});

/** Resolves `:id` to a conference the signed-in user organizes, or throws. */
async function requireOrganizer(conferenceIdParam: string, userId: string) {
  const conferenceId = parseInt(conferenceIdParam);
  if (!Number.isInteger(conferenceId)) {
    throw new HTTPException(400, {
      message: `Invalid conference id ${conferenceIdParam}`,
    });
  }

  const [user, conference] = await Promise.all([
    getUserById(userId),
    getConferenceById(conferenceId),
  ]);
  if (!user) throw new HTTPException(401, { message: "User not found" });
  if (!conference) {
    throw new HTTPException(404, {
      message: `Conference with id ${conferenceId} not found`,
    });
  }

  const roles = await getConferenceRolesForConference(user.id, conferenceId);
  if (!roles.some((role) => role.role === "organizer")) {
    throw new HTTPException(403, { message: "User is not an organizer" });
  }

  return conference;
}

const toApiQuestion = (
  { userId: _userId, user, ...rest }: ConferenceQuestions[number],
) => ({
  ...rest,
  user: user
    ? { id: user.id, name: user.userMetadata?.["name"] ?? user.id }
    : undefined,
});

const conferenceQuestionsQuery = zod.object({
  live: zod.enum(["true", "false"]).optional(),
  event: zod.string().min(1).optional(),
  limit: zod.coerce.number().int().min(1).max(1000).optional(),
});

// Questions from every session of a conference (or only the live ones, or one
// session), for the organizer question feed.
app.get(
  "/api/v1/conferences/:id/questions",
  jwt(),
  zValidator("query", conferenceQuestionsQuery),
  async (c) => {
    const conference = await requireOrganizer(
      c.req.param("id"),
      c.get("jwtPayload").sub,
    );
    const { live, event, limit } = c.req.valid("query");

    const questions = await getConferenceQuestions(conference.id, {
      live: live === "true",
      ...(event ? { eventUid: event } : {}),
      ...(limit ? { limit } : {}),
    });

    return c.json({ data: questions.map(toApiQuestion) });
  },
);

// Activity totals for the organizer dashboard: the whole conference and each
// session (questions, votes, reactions, participants).
app.get("/api/v1/conferences/:id/stats", jwt(), async (c) => {
  const conference = await requireOrganizer(
    c.req.param("id"),
    c.get("jwtPayload").sub,
  );

  return c.json({ data: await getConferenceStats(conference.id) });
});

// One person's history in this conference, so moderators can check who they
// are before blocking them.
app.get("/api/v1/conferences/:id/users/:userId/activity", jwt(), async (c) => {
  const conference = await requireOrganizer(
    c.req.param("id"),
    c.get("jwtPayload").sub,
  );

  const activity = await getConferenceUserActivity(
    conference.id,
    c.req.param("userId"),
  );

  if (!activity) {
    throw new HTTPException(404, {
      message: `User ${c.req.param("userId")} not found`,
    });
  }

  return c.json({ data: activity });
});

export default app;
