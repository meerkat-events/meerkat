import { and, eq, gt, min, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import db from "../db.ts";
import { questions, votes } from "../schema.ts";

/*
 * A question's vote total is the sum of its votes' weights, so a supervote
 * counts SUPERVOTE_WEIGHT times. Every query that shows a question's votes
 * uses one of the two below, so the Q&A page, the stage screen and the
 * organizer views agree. (Activity stats that count how many votes people
 * cast are a different number and use COUNT.)
 */

/** Vote total for a query that left-joins votes and groups by question. */
export const voteTotal = sql<number>`COALESCE(SUM(${votes.weight}), 0)`
  .mapWith(Number)
  .as("votes");

/** Vote total for a query that doesn't join votes: a correlated subquery. */
export function voteTotalOf(questionId: AnyPgColumn) {
  return sql<number>`(
    SELECT COALESCE(SUM(v.weight), 0)::int FROM votes v
    WHERE v.question_id = ${questionId}
  )`
    .mapWith(Number)
    .as("votes");
}

export async function createVote(
  questionId: number,
  userId: string,
): Promise<Vote> {
  const [newVote] = await db.insert(votes).values({
    questionId: questionId,
    userId: userId,
    createdAt: new Date(),
  }).returning().execute();

  if (!newVote) throw new Error("Failed to create vote");
  return newVote;
}

export async function deleteVote(
  questionId: number,
  userId: string,
): Promise<void> {
  await db.delete(votes).where(
    and(
      eq(votes.questionId, questionId),
      eq(votes.userId, userId),
    ),
  ).execute();
}

const votesByEventIdAndUserId = db
  .select()
  .from(votes)
  .where(
    and(
      eq(votes.questionId, sql.placeholder("question_id")),
      eq(votes.userId, sql.placeholder("user_id")),
    ),
  )
  .prepare("votes_by_event_id_and_user_id");

export async function getVotesByQuestionIdAndUserId(
  { questionId, userId }: { questionId: number; userId: string },
) {
  const [results]: Vote[] | undefined = await votesByEventIdAndUserId.execute(
    {
      question_id: questionId,
      user_id: userId,
    },
  );

  return results;
}

/**
 * How many votes the user has cast on the event's questions since `date`, and
 * when the oldest of them was made: a rate limit over that window frees up once
 * the oldest leaves it.
 */
export async function getUserVoteCountAfterDate(
  userId: string,
  eventId: number,
  date: Date,
): Promise<{ count: number; oldest: Date | null }> {
  const result = await db
    .select({ count: sql<number>`count(*)`, oldest: min(votes.createdAt) })
    .from(votes)
    .innerJoin(questions, eq(votes.questionId, questions.id))
    .where(
      and(
        eq(votes.userId, userId),
        eq(questions.eventId, eventId),
        gt(votes.createdAt, date),
      ),
    )
    .execute();

  return {
    count: Number(result.at(0)?.count ?? 0),
    oldest: result.at(0)?.oldest ?? null,
  };
}

export type Vote = typeof votes.$inferSelect;
