import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { events, questions, users, votes } from "../schema.ts";
import db from "../db.ts";
import { tierFor } from "../tiers.ts";
import { visibleQuestion } from "./questions.ts";
import { notBanned, userName } from "./user.ts";

/**
 * Points a participant earns at a conference. Only what others do for them
 * counts: a moderator picking their question for the stage, and votes on their
 * questions. A supervote is simply that many votes.
 */
export const SCORING = {
  picked: 5,
  vote: 1,
} as const;

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
      and(eq(events.conferenceId, conferenceId), visibleQuestion, notBanned()),
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
      and(eq(events.conferenceId, conferenceId), visibleQuestion, notBanned()),
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

/**
 * The participants with the most points at a conference, most first, for
 * organizers (attendees see no leaderboard). Ties go to who was picked more.
 */
export async function getTopContributors(conferenceId: number, limit: number) {
  const askers = await getAskerStats(conferenceId);
  const top = askers
    .map((asker) => ({
      ...asker,
      points: asker.picked * SCORING.picked + asker.votesReceived * SCORING.vote,
    }))
    .filter((asker) => asker.points > 0)
    .sort((a, b) => b.points - a.points || b.picked - a.picked)
    .slice(0, limit);
  if (top.length === 0) return [];

  const people = await db
    .select({ id: users.id, name: userName })
    .from(users)
    .where(inArray(users.id, top.map((asker) => asker.userId)))
    .execute();
  const nameOf = (userId: string) =>
    people.find((person) => person.id === userId)?.name ?? userId;

  return top.map((asker) => ({
    userId: asker.userId,
    name: nameOf(asker.userId),
    points: asker.points,
    picked: asker.picked,
    votesReceived: asker.votesReceived,
  }));
}
