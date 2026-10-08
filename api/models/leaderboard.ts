import { and, eq, isNull, lte, ne, or, sql } from "drizzle-orm";
import { events, questions, users, votes } from "../schema.ts";
import db from "../db.ts";

/**
 * Points awarded per action towards a participant's overall score. A vote
 * given is worth half a vote received, so tapping upvotes alone can't outrank
 * asking questions that people vote for.
 */
export const SCORING = {
  question: 2,
  picked: 5,
  received: 2,
  given: 1,
} as const;

export type LeaderboardEntry = Awaited<
  ReturnType<typeof getLeaderboard>
>[number];

const notBanned = or(isNull(users.bannedUntil), lte(users.bannedUntil, new Date()));

/** Questions asked, picked and votes received, per asker. */
function getAskerStats(conferenceId: number) {
  return db
    .select({
      userId: questions.userId,
      user: users,
      questions: sql`COUNT(DISTINCT ${questions.id})`.mapWith(Number),
      picked: sql`COUNT(DISTINCT ${questions.id}) FILTER (WHERE ${questions.selectedAt} IS NOT NULL OR ${questions.answeredAt} IS NOT NULL)`
        .mapWith(Number),
      // Weighted like question vote counts, so supervotes count extra
      received: sql`COALESCE(SUM(${votes.weight}), 0)`.mapWith(Number),
      firstActiveAt: sql`MIN(${questions.createdAt})`.mapWith((value) =>
        new Date(value).getTime()
      ),
    })
    .from(questions)
    .innerJoin(events, eq(questions.eventId, events.id))
    .innerJoin(users, eq(questions.userId, users.id))
    .leftJoin(votes, eq(questions.id, votes.questionId))
    .where(
      and(
        eq(events.conferenceId, conferenceId),
        isNull(questions.deletedAt),
        notBanned,
      ),
    )
    .groupBy(questions.userId, users.id)
    .execute();
}

/** Votes cast on other people's questions, per voter. */
function getVoterStats(conferenceId: number) {
  return db
    .select({
      userId: votes.userId,
      user: users,
      given: sql`COUNT(*)`.mapWith(Number),
      firstActiveAt: sql`MIN(${votes.createdAt})`.mapWith((value) =>
        new Date(value).getTime()
      ),
    })
    .from(votes)
    .innerJoin(questions, eq(votes.questionId, questions.id))
    .innerJoin(events, eq(questions.eventId, events.id))
    .innerJoin(users, eq(votes.userId, users.id))
    .where(
      and(
        eq(events.conferenceId, conferenceId),
        isNull(questions.deletedAt),
        ne(questions.userId, votes.userId),
        notBanned,
      ),
    )
    .groupBy(votes.userId, users.id)
    .execute();
}

/**
 * Everyone who asked or voted across every event of a conference. A question
 * counts as "picked" once a moderator selects it for the stage or marks it
 * answered. Entries are ordered by score, with ties broken by picks, votes
 * received, votes given, then who took part earliest, and finally by user
 * id, so every entry has its own place on the board.
 */
export async function getLeaderboard(conferenceId: number) {
  const [askers, voters] = await Promise.all([
    getAskerStats(conferenceId),
    getVoterStats(conferenceId),
  ]);

  const byUser = new Map(
    askers.map((asker) => [asker.userId, { ...asker, given: 0 }]),
  );
  for (const voter of voters) {
    const entry = byUser.get(voter.userId);
    if (entry) {
      entry.given = voter.given;
      entry.firstActiveAt = Math.min(entry.firstActiveAt, voter.firstActiveAt);
    } else {
      byUser.set(voter.userId, {
        ...voter,
        questions: 0,
        picked: 0,
        received: 0,
      });
    }
  }

  return [...byUser.values()]
    .map((row) => ({
      ...row,
      score: row.questions * SCORING.question +
        row.picked * SCORING.picked +
        row.received * SCORING.received +
        row.given * SCORING.given,
    }))
    .sort((a, b) =>
      b.score - a.score ||
      b.picked - a.picked ||
      b.received - a.received ||
      b.given - a.given ||
      a.firstActiveAt - b.firstActiveAt ||
      a.userId.localeCompare(b.userId)
    )
    // The tie-break time isn't part of the API response
    .map(({ firstActiveAt: _firstActiveAt, ...entry }) => entry);
}
