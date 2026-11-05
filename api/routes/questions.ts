import { Hono, type HonoRequest } from "hono";
import zod from "zod";
import { HTTPException } from "hono/http-exception";
import { MAX_VOTES_PER_EVENT } from "../moderation.ts";
import { jwt } from "../middlewares/jwt.ts";
import { getEventById } from "../models/events.ts";
import {
  deleteQuestion,
  getQuestionByUID,
  hideQuestion,
  markAsAnswered,
  restoreQuestion,
  selectQuestion,
  toPublicQuestion,
} from "../models/questions.ts";
import {
  canModerate,
  isOrganizer,
  getConferenceRolesForConference,
} from "../models/roles.ts";
import { getUserById } from "../models/user.ts";
import {
  createVote,
  deleteVote,
  getUserVoteTimesAfterDate,
  getVotesByQuestionIdAndUserId,
} from "../models/votes.ts";
import {
  requireParticipation,
  requireUnblockedUser,
} from "../utils/require-participant.ts";
import {
  enforceRateLimit,
  windowStartSecondsAgo,
} from "../utils/too-many-requests.ts";
import logger from "../logger.ts";
import { notifyQuestionsChanged } from "../realtime/notify.ts";
import {
  spendSupervote,
  SUPERVOTE_WEIGHT,
} from "../models/supervotes.ts";

const app = new Hono();

export const OWN_QUESTION_MESSAGE = "You can't vote for your own question";

// `{ "weight": 3 }` (SUPERVOTE_WEIGHT) spends a supervote on the new vote.
const upvoteSchema = zod.object({
  weight: zod.union([zod.literal(1), zod.literal(SUPERVOTE_WEIGHT)])
    .default(1),
});

/**
 * The request's JSON body, or `{}` when there is none (older clients send
 * none). Malformed JSON is a 400, not an empty body.
 */
async function readOptionalJson(request: HonoRequest): Promise<unknown> {
  const text = await request.text();
  if (text.trim() === "") {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new HTTPException(400, { message: "Invalid JSON body" });
  }
}

/**
 * The checks every moderation route makes first: the user exists (401
 * otherwise), the question and its event exist (404), and the user holds
 * `requiredRole` in the event's conference (403). "moderator" lets
 * moderators and organizers through (`canModerate`), "organizer" only
 * organizers (`isOrganizer`).
 */
async function loadQuestionForModeration(
  userId: string,
  uid: string,
  requiredRole: "moderator" | "organizer",
) {
  const [user, question] = await Promise.all([
    getUserById(userId),
    getQuestionByUID(uid),
  ]);

  if (!user) {
    throw new HTTPException(401, { message: `User ${userId} not found` });
  }

  if (!question) {
    throw new HTTPException(404, { message: `Question ${uid} not found` });
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

  if (requiredRole === "organizer") {
    if (!isOrganizer(roles)) {
      throw new HTTPException(403, { message: `User is not an organizer` });
    }
  } else if (!canModerate(roles)) {
    throw new HTTPException(403, { message: `User is not a moderator` });
  }

  return { user, question, event };
}

app.post(
  "/api/v1/questions/:uid/upvote",
  jwt(),
  async (c) => {
    const uid = c.req.param("uid");
    const parsedBody = upvoteSchema.safeParse(await readOptionalJson(c.req));
    if (!parsedBody.success) {
      throw new HTTPException(400, {
        message: `Weight must be 1 or ${SUPERVOTE_WEIGHT}`,
      });
    }
    const { weight } = parsedBody.data;

    const payload = c.get("jwtPayload");

    const [foundUser, question] = await Promise.all([
      getUserById(payload.sub),
      getQuestionByUID(uid),
    ]);
    const user = requireUnblockedUser(foundUser, payload.sub);

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

    await requireParticipation(user.id, event.conferenceId);

    const minuteAgo = windowStartSecondsAgo(60);
    const recentVotes = await getUserVoteTimesAfterDate(
      user.id,
      event.id,
      minuteAgo,
    );

    enforceRateLimit({
      recent: recentVotes,
      max: MAX_VOTES_PER_EVENT,
      windowStart: minuteAgo,
      message: "User has too many votes",
    });

    const existingVote = await getVotesByQuestionIdAndUserId({
      questionId: question.id,
      userId: user.id,
    });
    const hasVoted = !!existingVote;

    // Votes, supervotes above all, are for other people's questions. A vote
    // cast on one's own question before this rule can still be removed.
    if (!hasVoted && question.userId === user.id) {
      throw new HTTPException(403, { message: OWN_QUESTION_MESSAGE });
    }

    // The endpoint toggles: voting again removes the vote. A supervote is
    // spent once and can't be removed, and a supervote request never removes
    // a vote (a double tap would otherwise undo the one just spent).
    if (existingVote && existingVote.weight > 1) {
      throw new HTTPException(409, {
        message: "A supervote can't be removed",
      });
    }
    if (existingVote && weight === SUPERVOTE_WEIGHT) {
      throw new HTTPException(409, {
        message: "You already voted for this question",
      });
    }

    if (hasVoted) {
      await deleteVote(question.id, user.id);
    } else if (weight === SUPERVOTE_WEIGHT) {
      const isSpent = await spendSupervote(question.id, user.id);
      if (!isSpent) {
        throw new HTTPException(409, { message: "No supervotes left" });
      }
    } else {
      await createVote(question.id, user.id);
    }

    void notifyQuestionsChanged(event);

    logger.info(
      {
        questionUid: question.uid,
        userId: user.id,
        eventId: event.id,
        removed: hasVoted,
        weight,
      },
      "Upvoted question",
    );

    return c.json({ data: toPublicQuestion(question) });
  },
);

app.post(
  "/api/v1/questions/:uid/select",
  jwt(),
  async (c) => {
    const uid = c.req.param("uid");
    const { user, question, event } = await loadQuestionForModeration(
      c.get("jwtPayload").sub,
      uid,
      "moderator",
    );

    // Only its author can see it; restore it before putting it on stage.
    if (question.hiddenAt) {
      throw new HTTPException(409, {
        message: `Question ${uid} is hidden by moderation`,
      });
    }

    const result = await selectQuestion(question.id);

    if (!result) {
      throw new HTTPException(500, { message: `Failed to select question` });
    }

    void notifyQuestionsChanged(event);

    logger.info(
      {
        questionUid: question.uid,
        question: question.question,
        eventId: event.id,
        userId: user.id,
      },
      "Selected question",
    );

    return c.json({ data: toPublicQuestion(result) });
  },
);

app.post(
  "/api/v1/questions/:uid/mark-as-answered",
  jwt(),
  async (c) => {
    const uid = c.req.param("uid");
    const { user, question, event } = await loadQuestionForModeration(
      c.get("jwtPayload").sub,
      uid,
      "moderator",
    );

    const result = await markAsAnswered(question.id);

    if (!result) {
      throw new HTTPException(500, { message: `Failed to mark as answered` });
    }

    void notifyQuestionsChanged(event);

    logger.info(
      {
        questionUid: question.uid,
        question: question.question,
        eventId: event.id,
        userId: user.id,
      },
      "Marked question as answered",
    );

    return c.json({ data: toPublicQuestion(result) });
  },
);

app.delete(
  "/api/v1/questions/:uid",
  jwt(),
  async (c) => {
    const uid = c.req.param("uid");
    const { user, question, event } = await loadQuestionForModeration(
      c.get("jwtPayload").sub,
      uid,
      "moderator",
    );

    const result = await deleteQuestion(question.id);

    if (!result) {
      throw new HTTPException(500, {
        message: `Failed to delete question ${uid}`,
      });
    }

    void notifyQuestionsChanged(event);

    logger.info(
      {
        questionUid: question.uid,
        question: question.question,
        eventId: event.id,
        userId: user.id,
      },
      "Deleted question",
    );

    return c.json({ data: toPublicQuestion(result) });
  },
);

// Hides a question like automatic moderation does: its author still sees it,
// nobody else does, and an organizer can restore it.
app.post(
  "/api/v1/questions/:uid/hide",
  jwt(),
  async (c) => {
    const uid = c.req.param("uid");
    const { user, question, event } = await loadQuestionForModeration(
      c.get("jwtPayload").sub,
      uid,
      "moderator",
    );

    const result = await hideQuestion(question.id);

    if (!result) {
      throw new HTTPException(500, {
        message: `Failed to hide question ${uid}`,
      });
    }

    // Attendees saw it until now, so this tells nobody more than they knew.
    void notifyQuestionsChanged(event);

    logger.info(
      {
        questionUid: question.uid,
        question: question.question,
        eventId: event.id,
        userId: user.id,
      },
      "Hid question",
    );

    return c.json({ data: toPublicQuestion(result) });
  },
);

// Shows a hidden question (by automatic moderation or a moderator), after an
// organizer reviewed it.
app.post(
  "/api/v1/questions/:uid/restore",
  jwt(),
  async (c) => {
    const uid = c.req.param("uid");
    const { user, question, event } = await loadQuestionForModeration(
      c.get("jwtPayload").sub,
      uid,
      "organizer",
    );

    const result = await restoreQuestion(question.id);

    if (!result) {
      throw new HTTPException(500, {
        message: `Failed to restore question ${uid}`,
      });
    }

    void notifyQuestionsChanged(event);

    logger.info(
      {
        questionUid: uid,
        question: result.question,
        userId: user.id,
        eventId: event.id,
      },
      "Restored question hidden by moderation",
    );

    return c.json({ data: toPublicQuestion(result) });
  },
);

export default app;
