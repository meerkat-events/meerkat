import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import zod from "zod";
import env from "../env.ts";
import { getConferenceById } from "../models/conferences.ts";
import { HTTPException } from "hono/http-exception";
import { getLiveEvent } from "../models/events.ts";
import { jwt } from "../middlewares/jwt.ts";
import { getUserByEmail, getUserById } from "../models/user.ts";
import { grantRole } from "../models/roles.ts";
import {
  getConferenceAttendees,
  getConferencePermissions,
  removeInvitation,
  removeMember,
  upsertInvitation,
} from "../models/permissions.ts";
import {
  type ConferenceQuestions,
  getConferenceQuestions,
  getConferenceStats,
  getConferenceUserActivity,
} from "../models/conference-activity.ts";
import { summarizeModeration } from "../moderation-summary.ts";
import {
  getParticipantPoints,
  getTopContributors,
  SCORING,
} from "../models/points.ts";
import { hub } from "../realtime/index.ts";
import { eventStream } from "../realtime/sse.ts";
import { conferenceParams } from "../utils/conference-params.ts";
import { requireRole } from "../utils/require-participant.ts";

const app = new Hono();

// Public: the conference page's QR code points here, so a phone camera opens
// the Q&A page of the event the conference shows (live, else running, else
// next, else the one that ended last), like /stage/:stage/qa. It only
// redirects.
app.get(
  "/api/v1/conferences/:id/live",
  zValidator("param", conferenceParams),
  async (c) => {
    const { id: conferenceId } = c.req.valid("param");
    const liveEvent = await getLiveEvent(conferenceId);

    if (!liveEvent) {
      throw new HTTPException(404, {
        message: `No event found for conference ${conferenceId}`,
      });
    }

    return c.redirect(new URL(`/e/${liveEvent.uid}/qa`, env.base));
  },
);

/**
 * The conference, if it exists (404 otherwise) and the signed-in user
 * organizes it (403 otherwise).
 */
async function requireOrganizer(conferenceId: number, userId: string) {
  const conference = await getConferenceById(conferenceId);
  if (!conference) {
    throw new HTTPException(404, {
      message: `Conference with id ${conferenceId} not found`,
    });
  }

  await requireRole(userId, conferenceId, "organizer");

  return conference;
}

// Organizers get the verdict's summary (decision, reasons, relevance), never
// the raw scores; attendees never get it at all (toPublicQuestion).
const toApiQuestion = (
  { userId: _userId, user, moderation, viewerVoteWeight, ...rest }:
    ConferenceQuestions[number],
) => ({
  ...rest,
  moderation: summarizeModeration(moderation),
  vote: viewerVoteWeight === null ? null : { weight: viewerVoteWeight },
  user: user
    ? { id: user.id, name: user.userMetadata?.["name"] ?? user.id }
    : undefined,
});

// A time window, e.g. one day in the organizer's time zone, which only the
// browser knows: `from` inclusive, `to` exclusive, ISO 8601 with an offset.
const timeWindowQuery = zod.object({
  from: zod.iso.datetime({ offset: true }).optional(),
  to: zod.iso.datetime({ offset: true }).optional(),
});

const toTimeWindow = ({ from, to }: zod.infer<typeof timeWindowQuery>) => ({
  from: from ? new Date(from) : undefined,
  to: to ? new Date(to) : undefined,
});

const conferenceQuestionsQuery = timeWindowQuery.extend({
  live: zod.enum(["true", "false"]).optional(),
  event: zod.string().min(1).optional(),
  hidden: zod.enum(["true", "false"]).optional(),
  moderated: zod.enum(["true", "false"]).optional(),
  limit: zod.coerce.number().int().min(1).max(1000).optional(),
});

// Questions from every session of a conference (or only the live ones, or one
// session), for the organizer question feed. `hidden=true` also returns what
// organizers or automatic moderation hid, so they can review it;
// `moderated=true` returns only what automatic moderation hid or marked for
// review, and `from`/`to` only questions asked in that window.
app.get(
  "/api/v1/conferences/:id/questions",
  jwt(),
  zValidator("param", conferenceParams),
  zValidator("query", conferenceQuestionsQuery),
  async (c) => {
    const userId = c.get("jwtPayload").sub;
    const conference = await requireOrganizer(c.req.valid("param").id, userId);
    const { live, event, hidden, moderated, limit, ...window } = c.req.valid("query");

    const questions = await getConferenceQuestions(conference.id, {
      live: live === "true",
      includeHidden: hidden === "true",
      moderated: moderated === "true",
      asked: toTimeWindow(window),
      ...(event ? { eventUid: event } : {}),
      ...(limit ? { limit } : {}),
      viewerId: userId,
    });

    return c.json({ data: questions.map(toApiQuestion) });
  },
);

// Tells the organizer pages to refetch the questions above: an unnamed
// `update` whenever a question or vote of any session changes. No reactions.
// Public: it carries no data, only that something changed, which the public
// event streams tell anyone anyway (questions moderation hid send nothing).
// The questions themselves still need an organizer's token.
app.get(
  "/api/v1/conferences/:id/questions/stream",
  zValidator("param", conferenceParams),
  async (c) => {
    const conference = await getConferenceById(c.req.valid("param").id);
    if (!conference) {
      throw new HTTPException(404, { message: "Conference not found" });
    }

    return eventStream(c, (send) =>
      hub.listenToConference(conference.id, () => {
        send({ data: "update" });
      }));
  },
);

// Activity totals for the organizer dashboard: the whole conference and each
// session (questions, votes, reactions, participants, supervotes), and what
// automatic moderation did. `from`/`to` count only what happened in that window.
// `topContributors` ranks points, which add up over the whole conference.
app.get(
  "/api/v1/conferences/:id/stats",
  jwt(),
  zValidator("param", conferenceParams),
  zValidator("query", timeWindowQuery),
  async (c) => {
    const conference = await requireOrganizer(
      c.req.valid("param").id,
      c.get("jwtPayload").sub,
    );

    const [stats, topContributors] = await Promise.all([
      getConferenceStats(conference.id, {
        moderationEnabled: conference.moderation !== null,
        window: toTimeWindow(c.req.valid("query")),
      }),
      getTopContributors(conference.id, 10),
    ]);

    return c.json({ data: { ...stats, topContributors } });
  },
);

// One person's history in this conference, so moderators can check who they
// are before blocking them.
const userActivityParams = conferenceParams.extend({ userId: zod.string() });

app.get(
  "/api/v1/conferences/:id/users/:userId/activity",
  jwt(),
  zValidator("param", userActivityParams),
  async (c) => {
    const { id, userId } = c.req.valid("param");
    const conference = await requireOrganizer(id, c.get("jwtPayload").sub);

    const activity = await getConferenceUserActivity(conference.id, userId);

    if (!activity) {
      throw new HTTPException(404, { message: `User ${userId} not found` });
    }

    return c.json({ data: activity });
  },
);

// Who has access to the conference and with which role. Emails only ever
// reach organizers, through these routes. Nobody can change or remove their
// own role, so a conference always keeps an organizer.
app.get(
  "/api/v1/conferences/:id/permissions",
  jwt(),
  zValidator("param", conferenceParams),
  async (c) => {
    const conference = await requireOrganizer(
      c.req.valid("param").id,
      c.get("jwtPayload").sub,
    );

    return c.json({ data: await getConferencePermissions(conference.id) });
  },
);

// A cursor is where the previous page ended: `<grantedAt ISO>_<userId>`, as
// returned in `next`. It carries no email, unlike `search`, which
// instrumentation.ts redacts from traces.
const attendeeCursor = zod.string().transform((cursor, context) => {
  const [grantedAtText, userIdText] = cursor.split("_");
  const grantedAt = new Date(grantedAtText ?? "");
  const userId = zod.uuid().safeParse(userIdText);
  if (Number.isNaN(grantedAt.getTime()) || !userId.success) {
    context.addIssue({ code: "custom", message: "Invalid cursor" });
    return zod.NEVER;
  }
  return { grantedAt, userId: userId.data };
});

const attendeesQuery = zod.object({
  limit: zod.coerce.number().int().min(1).max(200).default(50),
  after: attendeeCursor.optional(),
  search: zod.string().trim().min(1).max(200).optional(),
});

app.get(
  "/api/v1/conferences/:id/permissions/attendees",
  jwt(),
  zValidator("param", conferenceParams),
  zValidator("query", attendeesQuery),
  async (c) => {
    const conference = await requireOrganizer(
      c.req.valid("param").id,
      c.get("jwtPayload").sub,
    );
    const { limit, after, search } = c.req.valid("query");

    const { attendees, next } = await getConferenceAttendees(conference.id, {
      limit,
      ...(after ? { after } : {}),
      ...(search ? { search } : {}),
    });

    return c.json({
      data: {
        attendees,
        next: next ? `${next.grantedAt.toISOString()}_${next.userId}` : null,
      },
    });
  },
);

const permissionBody = zod.object({
  email: zod.string().trim().toLowerCase().pipe(zod.email()),
  role: zod.enum(["organizer", "moderator", "attendee"]),
});

// Adds an email or changes its role. An email without an account is invited:
// it gets the role when it first signs up (handle_new_user).
app.post(
  "/api/v1/conferences/:id/permissions",
  jwt(),
  zValidator("param", conferenceParams),
  zValidator("json", permissionBody),
  async (c) => {
    const actorId = c.get("jwtPayload").sub;
    const conference = await requireOrganizer(c.req.valid("param").id, actorId);
    const { email, role } = c.req.valid("json");

    const user = await getUserByEmail(email);
    if (user?.id === actorId) {
      throw new HTTPException(400, {
        message: "You can't change your own role",
      });
    }

    if (user) {
      await grantRole(user.id, conference.id, role);
    } else {
      await upsertInvitation(conference.id, email, role);
    }

    return c.json({ data: { status: user ? "member" : "invited" } });
  },
);

const memberParams = conferenceParams.extend({ userId: zod.uuid() });

app.delete(
  "/api/v1/conferences/:id/permissions/members/:userId",
  jwt(),
  zValidator("param", memberParams),
  async (c) => {
    const actorId = c.get("jwtPayload").sub;
    const { id, userId } = c.req.valid("param");
    const conference = await requireOrganizer(id, actorId);

    if (userId === actorId) {
      throw new HTTPException(400, {
        message: "You can't remove your own access",
      });
    }
    if (!await removeMember(conference.id, userId)) {
      throw new HTTPException(404, { message: "Member not found" });
    }

    return c.body(null, 204);
  },
);

const invitationParams = conferenceParams.extend({
  invitationId: zod.coerce.number().int(),
});

app.delete(
  "/api/v1/conferences/:id/permissions/invitations/:invitationId",
  jwt(),
  zValidator("param", invitationParams),
  async (c) => {
    const { id, invitationId } = c.req.valid("param");
    const conference = await requireOrganizer(id, c.get("jwtPayload").sub);

    if (!await removeInvitation(conference.id, invitationId)) {
      throw new HTTPException(404, { message: "Invitation not found" });
    }

    return c.body(null, 204);
  },
);

const participantParams = conferenceParams.extend({ userId: zod.uuid() });

// One participant's points and percentile tier at a conference, fetched when
// someone opens their profile from a question (and for the signed-in user's
// own tier). Signed-in users only: guests see the questions, not profiles.
app.get(
  "/api/v1/conferences/:id/participants/:userId",
  jwt(),
  zValidator("param", participantParams),
  async (c) => {
    const { id: conferenceId, userId } = c.req.valid("param");

    const [user, points] = await Promise.all([
      getUserById(userId),
      getParticipantPoints(conferenceId, userId),
    ]);
    if (!user || !points) {
      throw new HTTPException(404, {
        message: `User ${userId} has not taken part in conference ${conferenceId}`,
      });
    }

    return c.json({
      data: {
        user: { id: user.id, name: user.userMetadata?.["name"] ?? user.id },
        ...points,
      },
      scoring: SCORING,
    });
  },
);

export default app;
