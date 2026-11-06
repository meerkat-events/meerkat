import { Hono, type HonoRequest } from "hono";
import zod from "zod";
import { HTTPException } from "hono/http-exception";
import { MAX_VOTES_PER_EVENT } from "../moderation.ts";
import { jwt } from "../middlewares/jwt.ts";
import { getEventById } from "../models/events.ts";
import {
  getQuestionByUID,
  hideQuestion,
  markAsAnswered,
  type Question,
  restoreQuestion,
  selectQuestion,
  toPublicQuestion,
} from "../models/questions.ts";
import { getUserById } from "../models/user.ts";
import {
  createVote,
  deleteVote,
  getUserVoteTimesAfterDate,
  getVotesByQuestionIdAndUserId,
} from "../models/votes.ts";
import {
  requireParticipation,
  requireRole,
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
 * The checks every moderation route makes first: the question and its event
 * exist (404), and the user holds `requiredRole` in the event's conference
 * (403, see `requireRole`).
 */
async function loadQuestionForModeration(
  userId: string,
  uid: string,
  requiredRole: "moderator" | "organizer",
) {
  const question = await getQuestionByUID(uid);

  if (!question) {
    throw new HTTPException(404, { message: `Question ${uid} not found` });
  }

  const event = await getEventById(question.eventId);

  if (!event) {
    throw new HTTPException(404, {
      message: `Event ${question.eventId} not found`,
    });
  }

  await requireRole(userId, event.conferenceId, requiredRole);

  return { question, event };
}

/**
 * Registers a moderation route, `POST /api/v1/questions/:uid/<action>`: it
 * loads the question for a user with `requiredRole`, runs `act` on it (500 if
 * that changes nothing), tells the event's streams, logs `logMessage` and
 * returns the changed question.
 */
function moderationRoute(
  path: `/api/v1/questions/:uid/${string}`,
  requiredRole: "moderator" | "organizer",
  act: (question: Question) => Promise<Question | null | undefined>,
  logMessage: string,
) {
  app.post(path, jwt(), async (c) => {
    const uid = c.req.param("uid");
    const userId = c.get("jwtPayload").sub;
    const { question, event } = await loadQuestionForModeration(
      userId,
      uid,
      requiredRole,
    );

    const result = await act(question);

    if (!result) {
      throw new HTTPException(500, {
        message: `Failed to update question ${uid}`,
      });
    }

    void notifyQuestionsChanged(event);

    logger.info(
      {
        questionUid: question.uid,
        question: question.question,
        eventId: event.id,
        userId,
      },
      logMessage,
    );

    return c.json({ data: toPublicQuestion(result) });
  });
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

moderationRoute(
  "/api/v1/questions/:uid/select",
  "moderator",
  (question) => {
    // Only its author can see it; restore it before putting it on stage.
    if (question.hiddenAt) {
      throw new HTTPException(409, {
        message: `Question ${question.uid} is hidden by moderation`,
      });
    }
    return selectQuestion(question.id);
  },
  "Selected question",
);

moderationRoute(
  "/api/v1/questions/:uid/mark-as-answered",
  "moderator",
  (question) => markAsAnswered(question.id),
  "Marked question as answered",
);

// Hides a question like automatic moderation does: its author still sees it,
// nobody else does, and an organizer can restore it. Attendees saw it until
// now, so the stream's update tells nobody more than they knew.
moderationRoute(
  "/api/v1/questions/:uid/hide",
  "moderator",
  (question) => hideQuestion(question.id),
  "Hid question",
);

// Shows a hidden question (by automatic moderation or a moderator), after an
// organizer reviewed it.
moderationRoute(
  "/api/v1/questions/:uid/restore",
  "organizer",
  (question) => restoreQuestion(question.id),
  "Restored question hidden by moderation",
);

export default app;
