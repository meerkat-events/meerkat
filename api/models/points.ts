import { and, eq, isNull, lte, ne, or, sql } from "drizzle-orm";
import { events, questions, users, votes } from "../schema.ts";
import db from "../db.ts";
import { tierFor } from "../tiers.ts";

/**
 * Points a participant earns at a conference. Only what others do for them
 * counts: a moderator picking their question for the stage, and votes on their
 * questions. A supervote is simply that many votes.
 */
export const SCORING = {
  picked: 5,
  vote: 1,
} as const;

// The database's clock, so a ban that runs out counts as over right away
const notBanned = or(
  isNull(users.bannedUntil),
  lte(users.bannedUntil, sql`NOW()`),
);

// Questions the public sees: not deleted, not hidden by moderation
const isVisibleQuestion = and(
  isNull(questions.deletedAt),
  isNull(questions.hiddenAt),
);

/** Picks and votes received (weighted, own votes left out), per asker. */
function getAskerStats(conferenceId: number) {
  return db
    .select({
      userId: questions.userId,
      picked: sql`COUNT(DISTINCT ${questions.id}) FILTER (WHERE ${questions.selectedAt} IS NOT NULL OR ${questions.answeredAt} IS NOT NULL)`
        .mapWith(Number),
      votesReceived: sql`COALESCE(SUM(${votes.weight}), 0)`.mapWith(Number),
    })
    .from(questions)
    .innerJoin(events, eq(questions.eventId, events.id))
    .innerJoin(users, eq(questions.userId, users.id))
    .leftJoin(
      votes,
      and(
        eq(votes.questionId, questions.id),
        ne(votes.userId, questions.userId),
      ),
    )
    .where(
      and(eq(events.conferenceId, conferenceId), isVisibleQuestion, notBanned),
    )
    .groupBy(questions.userId)
    .execute();
}

/** Everyone who voted on a question at the conference. */
function getVoterIds(conferenceId: number) {
  return db
    .selectDistinct({ userId: votes.userId })
    .from(votes)
    .innerJoin(questions, eq(votes.questionId, questions.id))
    .innerJoin(events, eq(questions.eventId, events.id))
    .innerJoin(users, eq(votes.userId, users.id))
    .where(
      and(eq(events.conferenceId, conferenceId), isVisibleQuestion, notBanned),
    )
    .execute();
}

/**
 * One participant's points at a conference, and their percentile tier among
 * everyone who asked or voted there. Undefined when they did neither.
 */
export async function getParticipantPoints(
  conferenceId: number,
  userId: string,
) {
  const [askers, voters] = await Promise.all([
    getAskerStats(conferenceId),
    getVoterIds(conferenceId),
  ]);

  const scores = new Map<string, number>();
  for (const voter of voters) {
    scores.set(voter.userId, 0);
  }
  for (const asker of askers) {
    scores.set(
      asker.userId,
      asker.picked * SCORING.picked + asker.votesReceived * SCORING.vote,
    );
  }

  const points = scores.get(userId);
  if (points === undefined) return undefined;

  const asker = askers.find((row) => row.userId === userId);
  const ahead = [...scores.values()].filter((score) => score > points).length;

  return {
    points,
    picked: asker?.picked ?? 0,
    votesReceived: asker?.votesReceived ?? 0,
    // Nobody is "top" anything without a single point
    tier: points > 0 ? tierFor(ahead + 1, scores.size) : null,
    contributors: scores.size,
  };
}
