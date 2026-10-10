import { and, count, desc, eq, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import db from "../db.ts";
import { summarizeModeration, tallyModeration } from "../moderation-summary.ts";
import {
  events,
  lower,
  questions,
  reactions,
  users,
  votes,
} from "../schema.ts";

const notBlocked = () =>
  or(isNull(users.bannedUntil), lte(users.bannedUntil, new Date()));

// Questions automatic moderation hid are shadow-hidden: attendees never see
// them, so counts of what happened in a session leave them out. Organizers
// see them only where they review moderation (feed, person history).
const notModerationHidden = isNull(questions.hiddenAt);

const votesSnippet = sql`COUNT(${votes.questionId})`.mapWith(Number).as(
  "votes",
);

/**
 * Questions across a conference, newest first, for organizers moderating
 * several stages at once. Questions from blocked users are left out. Hidden
 * ones, by an organizer or by automatic moderation, only with `includeHidden`.
 */
export function getConferenceQuestions(
  conferenceId: number,
  options: {
    live?: boolean;
    eventUid?: string;
    limit?: number;
    /** Also what organizers or automatic moderation hid, to review it. */
    includeHidden?: boolean;
  } = {},
) {
  const conditions = [
    eq(events.conferenceId, conferenceId),
    notBlocked(),
  ];
  if (!options.includeHidden) {
    conditions.push(isNull(questions.deletedAt), notModerationHidden);
  }
  if (options.live) conditions.push(eq(events.live, true));
  if (options.eventUid) {
    conditions.push(eq(lower(events.uid), options.eventUid.toLowerCase()));
  }

  return db
    .select({
      id: questions.id,
      uid: questions.uid,
      eventId: questions.eventId,
      question: questions.question,
      createdAt: questions.createdAt,
      selectedAt: questions.selectedAt,
      answeredAt: questions.answeredAt,
      deletedAt: questions.deletedAt,
      hiddenAt: questions.hiddenAt,
      moderation: questions.moderation,
      userId: questions.userId,
      user: users,
      votes: votesSnippet,
      event: {
        id: events.id,
        uid: events.uid,
        title: events.title,
        stage: events.stage,
      },
    })
    .from(questions)
    .innerJoin(events, eq(questions.eventId, events.id))
    .leftJoin(votes, eq(questions.id, votes.questionId))
    .leftJoin(users, eq(questions.userId, users.id))
    .where(and(...conditions))
    .groupBy(questions.id, users.id, events.id)
    .orderBy(desc(questions.createdAt))
    .limit(options.limit ?? 500)
    .execute();
}

export type ConferenceQuestions = Awaited<
  ReturnType<typeof getConferenceQuestions>
>;

type EventCounts = {
  questions: number;
  votes: number;
  reactions: number;
  participants: number;
  /** Questions automatic moderation hid and nobody restored. */
  autoHidden: number;
  /** Questions moderation shows but marked for an organizer to check. */
  review: number;
  /** Average relevance (0 to 4) of the questions attendees saw. */
  relevance: number | null;
};

/**
 * Activity totals for a conference and for each of its sessions. Participants
 * are people who asked or voted (as in `countParticipants`), counted once
 * across the whole conference for the totals. Counts cover what attendees
 * saw; `moderation` adds what automatic moderation did.
 */
export async function getConferenceStats(
  conferenceId: number,
  { moderationEnabled }: { moderationEnabled: boolean },
) {
  const inConference = eq(events.conferenceId, conferenceId);

  const [questionRows, voteRows, reactionRows, participantRows, total, verdictRows] =
    await Promise.all([
      // Same questions the feed and Q&A show: not hidden, author not blocked.
      db.select({ eventId: questions.eventId, n: count() })
        .from(questions)
        .innerJoin(events, eq(questions.eventId, events.id))
        .leftJoin(users, eq(questions.userId, users.id))
        .where(and(
          inConference,
          isNull(questions.deletedAt),
          notModerationHidden,
          notBlocked(),
        ))
        .groupBy(questions.eventId)
        .execute(),
      db.select({ eventId: questions.eventId, n: count() })
        .from(votes)
        .innerJoin(questions, eq(votes.questionId, questions.id))
        .innerJoin(events, eq(questions.eventId, events.id))
        .where(and(inConference, notModerationHidden))
        .groupBy(questions.eventId)
        .execute(),
      db.select({ eventId: reactions.eventId, n: count() })
        .from(reactions)
        .innerJoin(events, eq(reactions.eventId, events.id))
        .where(inConference)
        .groupBy(reactions.eventId)
        .execute(),
      db.execute<{ event_id: number; n: number }>(sql`
        SELECT p.event_id, COUNT(DISTINCT p.user_id)::int AS n
        FROM (${participantsSql(conferenceId)}) AS p
        GROUP BY p.event_id`),
      db.execute<{ n: number }>(sql`
        SELECT COUNT(DISTINCT p.user_id)::int AS n
        FROM (${participantsSql(conferenceId)}) AS p`),
      // Every verdict, to tally moderation and relevance.
      db.select({
        eventId: questions.eventId,
        hiddenAt: questions.hiddenAt,
        deletedAt: questions.deletedAt,
        moderation: questions.moderation,
      })
        .from(questions)
        .innerJoin(events, eq(questions.eventId, events.id))
        .where(and(inConference, isNotNull(questions.moderation)))
        .execute(),
    ]);

  const moderation = tallyModeration(verdictRows, moderationEnabled);

  const byEvent = new Map<number, EventCounts>();
  const get = (eventId: number) => {
    let counts = byEvent.get(eventId);
    if (!counts) {
      counts = {
        questions: 0,
        votes: 0,
        reactions: 0,
        participants: 0,
        autoHidden: 0,
        review: 0,
        relevance: null,
      };
      byEvent.set(eventId, counts);
    }
    return counts;
  };
  questionRows.forEach((r) => (get(r.eventId).questions = r.n));
  voteRows.forEach((r) => (get(r.eventId).votes = r.n));
  reactionRows.forEach((r) => (get(r.eventId).reactions = r.n));
  for (const r of participantRows) get(r.event_id).participants = r.n;
  for (const [eventId, m] of moderation.perEvent) {
    const counts = get(eventId);
    counts.autoHidden = m.autoHidden;
    counts.review = m.review;
    counts.relevance = m.scored > 0 ? m.relevanceSum / m.scored : null;
  }

  const sum = (key: "questions" | "votes" | "reactions") =>
    [...byEvent.values()].reduce((acc, counts) => acc + counts[key], 0);

  return {
    totals: {
      questions: sum("questions"),
      votes: sum("votes"),
      reactions: sum("reactions"),
      participants: total.at(0)?.n ?? 0,
    },
    moderation: moderation.totals,
    events: [...byEvent.entries()].map(([eventId, counts]) => ({
      eventId,
      ...counts,
    })),
  };
}

// Everyone who asked or voted in a conference session, one row per
// (session, person).
function participantsSql(conferenceId: number) {
  return sql`
    SELECT ${questions.eventId} AS event_id, ${questions.userId} AS user_id
    FROM ${questions}
    INNER JOIN ${events} ON ${events.id} = ${questions.eventId}
    WHERE ${events.conferenceId} = ${conferenceId}
      AND ${questions.hiddenAt} IS NULL
    UNION
    SELECT ${questions.eventId} AS event_id, ${votes.userId} AS user_id
    FROM ${votes}
    INNER JOIN ${questions} ON ${questions.id} = ${votes.questionId}
    INNER JOIN ${events} ON ${events.id} = ${questions.eventId}
    WHERE ${events.conferenceId} = ${conferenceId}
      AND ${questions.hiddenAt} IS NULL`;
}

export type UserActivity = Awaited<ReturnType<typeof getConferenceUserActivity>>;

/**
 * One person's history in a conference: the questions they asked (hidden ones
 * included, so moderators can see the whole picture) and the sessions they
 * took part in by asking or voting.
 */
export async function getConferenceUserActivity(
  conferenceId: number,
  userId: string,
) {
  const [person] = await db
    .select({
      id: users.id,
      userMetadata: users.userMetadata,
      bannedUntil: users.bannedUntil,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .execute();

  if (!person) return null;

  const [asked, upvoted, votesCast, sessionRows] = await Promise.all([
    db.select({
      id: questions.id,
      eventId: questions.eventId,
      uid: questions.uid,
      question: questions.question,
      createdAt: questions.createdAt,
      selectedAt: questions.selectedAt,
      answeredAt: questions.answeredAt,
      deletedAt: questions.deletedAt,
      hiddenAt: questions.hiddenAt,
      moderation: questions.moderation,
      votes: votesSnippet,
      event: {
        uid: events.uid,
        title: events.title,
        stage: events.stage,
        start: events.start,
      },
    })
      .from(questions)
      .innerJoin(events, eq(questions.eventId, events.id))
      .leftJoin(votes, eq(questions.id, votes.questionId))
      .where(and(
        eq(questions.userId, userId),
        eq(events.conferenceId, conferenceId),
      ))
      .groupBy(questions.id, events.id)
      .orderBy(desc(questions.createdAt))
      .execute(),
    // The questions they upvoted, with whoever asked them and that question's
    // total votes (not just this person's).
    db.select({
      id: questions.id,
      eventId: questions.eventId,
      uid: questions.uid,
      question: questions.question,
      createdAt: questions.createdAt,
      selectedAt: questions.selectedAt,
      answeredAt: questions.answeredAt,
      deletedAt: questions.deletedAt,
      votes: sql<number>`(SELECT COUNT(*)::int FROM votes v WHERE v.question_id = ${questions.id})`
        .mapWith(Number).as("votes"),
      askedById: questions.userId,
      askedByMetadata: users.userMetadata,
      event: {
        uid: events.uid,
        title: events.title,
        stage: events.stage,
        start: events.start,
      },
    })
      .from(questions)
      .innerJoin(events, eq(questions.eventId, events.id))
      .leftJoin(users, eq(questions.userId, users.id))
      .where(and(
        eq(events.conferenceId, conferenceId),
        notModerationHidden,
        sql`EXISTS (SELECT 1 FROM votes v WHERE v.question_id = ${questions.id} AND v.user_id = ${userId})`,
      ))
      .orderBy(desc(questions.createdAt))
      .execute(),
    db.select({ n: count() })
      .from(votes)
      .innerJoin(questions, eq(votes.questionId, questions.id))
      .innerJoin(events, eq(questions.eventId, events.id))
      .where(and(
        eq(votes.userId, userId),
        eq(events.conferenceId, conferenceId),
        notModerationHidden,
      ))
      .execute(),
    // Every session they touched, with what they did there.
    db.execute<{
      uid: string;
      title: string;
      stage: string;
      start: Date;
      questions: number;
      votes: number;
      reactions: number;
    }>(sql`
      SELECT e.uid, e.title, e.stage, e.start,
        (SELECT COUNT(*)::int FROM questions q
          WHERE q.event_id = e.id AND q.user_id = ${userId}) AS questions,
        (SELECT COUNT(*)::int FROM votes v
          INNER JOIN questions q ON q.id = v.question_id
          WHERE q.event_id = e.id AND v.user_id = ${userId}
            AND q.hidden_at IS NULL) AS votes,
        (SELECT COUNT(*)::int FROM reactions r
          WHERE r.event_id = e.id AND r.user_id = ${userId}) AS reactions
      FROM ${events} e
      WHERE e.conference_id = ${conferenceId}
        AND (
          EXISTS (SELECT 1 FROM questions q WHERE q.event_id = e.id AND q.user_id = ${userId})
          OR EXISTS (SELECT 1 FROM votes v INNER JOIN questions q ON q.id = v.question_id
                      WHERE q.event_id = e.id AND v.user_id = ${userId}
                        AND q.hidden_at IS NULL)
          OR EXISTS (SELECT 1 FROM reactions r WHERE r.event_id = e.id AND r.user_id = ${userId})
        )
      ORDER BY e.start DESC`),
  ]);

  const blocked = !!person.bannedUntil && person.bannedUntil > new Date();
  // Hidden by an organizer or by automatic moderation.
  const isHidden = (q: { deletedAt: Date | null; hiddenAt: Date | null }) =>
    q.deletedAt !== null || q.hiddenAt !== null;

  return {
    user: {
      id: person.id,
      name: (person.userMetadata?.["name"] as string | undefined) ?? person.id,
      blocked,
    },
    summary: {
      questions: asked.filter((q) => !isHidden(q)).length,
      hidden: asked.filter(isHidden).length,
      votes: votesCast.at(0)?.n ?? 0,
      reactions: sessionRows.reduce((total, s) => total + s.reactions, 0),
      sessions: sessionRows.length,
    },
    sessions: sessionRows,
    questions: asked.map(({ moderation, ...rest }) => ({
      ...rest,
      moderation: summarizeModeration(moderation),
    })),
    upvoted: upvoted.map(({ askedById, askedByMetadata, ...rest }) => ({
      ...rest,
      user: {
        id: askedById,
        name: (askedByMetadata?.["name"] as string | undefined) ?? askedById,
      },
    })),
  };
}
