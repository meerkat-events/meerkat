import { and, count, desc, eq, isNull, lte, or, sql } from "drizzle-orm";
import db from "../db.ts";
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

const votesSnippet = sql`COUNT(${votes.questionId})`.mapWith(Number).as(
  "votes",
);

/**
 * Questions across a conference, newest first, for organizers moderating
 * several stages at once. Hidden questions and questions from blocked users
 * are left out, matching what attendees see.
 */
export function getConferenceQuestions(
  conferenceId: number,
  options: { live?: boolean; eventUid?: string; limit?: number } = {},
) {
  const conditions = [
    eq(events.conferenceId, conferenceId),
    isNull(questions.deletedAt),
    notBlocked(),
  ];
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
};

/**
 * Activity totals for a conference and for each of its sessions. Participants
 * are people who asked or voted (as in `countParticipants`), counted once
 * across the whole conference for the totals.
 */
export async function getConferenceStats(conferenceId: number) {
  const inConference = eq(events.conferenceId, conferenceId);

  const [questionRows, voteRows, reactionRows, participantRows, total] =
    await Promise.all([
      // Same questions the feed and Q&A show: not hidden, author not blocked.
      db.select({ eventId: questions.eventId, n: count() })
        .from(questions)
        .innerJoin(events, eq(questions.eventId, events.id))
        .leftJoin(users, eq(questions.userId, users.id))
        .where(and(inConference, isNull(questions.deletedAt), notBlocked()))
        .groupBy(questions.eventId)
        .execute(),
      db.select({ eventId: questions.eventId, n: count() })
        .from(votes)
        .innerJoin(questions, eq(votes.questionId, questions.id))
        .innerJoin(events, eq(questions.eventId, events.id))
        .where(inConference)
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
    ]);

  const byEvent = new Map<number, EventCounts>();
  const get = (eventId: number) => {
    let counts = byEvent.get(eventId);
    if (!counts) {
      counts = { questions: 0, votes: 0, reactions: 0, participants: 0 };
      byEvent.set(eventId, counts);
    }
    return counts;
  };
  questionRows.forEach((r) => (get(r.eventId).questions = r.n));
  voteRows.forEach((r) => (get(r.eventId).votes = r.n));
  reactionRows.forEach((r) => (get(r.eventId).reactions = r.n));
  for (const r of participantRows) get(r.event_id).participants = r.n;

  const sum = (key: keyof EventCounts) =>
    [...byEvent.values()].reduce((acc, counts) => acc + counts[key], 0);

  return {
    totals: {
      questions: sum("questions"),
      votes: sum("votes"),
      reactions: sum("reactions"),
      participants: total.at(0)?.n ?? 0,
    },
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
    UNION
    SELECT ${questions.eventId} AS event_id, ${votes.userId} AS user_id
    FROM ${votes}
    INNER JOIN ${questions} ON ${questions.id} = ${votes.questionId}
    INNER JOIN ${events} ON ${events.id} = ${questions.eventId}
    WHERE ${events.conferenceId} = ${conferenceId}`;
}
