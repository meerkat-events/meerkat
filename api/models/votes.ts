import { and, asc, eq, gt, sql } from "drizzle-orm";
import db from "../db.ts";
import { questions, votes } from "../schema.ts";
import type { Question } from "./questions.ts";

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

const votesByUserIdStatement = db.select().from(votes).where(
  eq(votes.userId, sql.placeholder("user_id")),
).leftJoin(questions, eq(votes.questionId, questions.id)).prepare(
  "votes_by_user_id",
);

export async function getVotesByUserId(
  userId: string,
): Promise<(Vote & { question: Question })[]> {
  const results = await votesByUserIdStatement.execute({ user_id: userId });

  return results.map((result) => ({
    ...result.votes,
    question: result.questions as Question,
  }));
}

/**
 * When the user cast each vote on the event's questions since `date`, oldest
 * first. A rate limit over that window frees up as they leave it.
 */
export async function getUserVoteTimesAfterDate(
  userId: string,
  eventId: number,
  date: Date,
): Promise<Date[]> {
  const result = await db
    .select({ createdAt: votes.createdAt })
    .from(votes)
    .innerJoin(questions, eq(votes.questionId, questions.id))
    .where(
      and(
        eq(votes.userId, userId),
        eq(questions.eventId, eventId),
        gt(votes.createdAt, date),
      ),
    )
    .orderBy(asc(votes.createdAt))
    .execute();

  return result.map((row) => row.createdAt);
}

export type Vote = typeof votes.$inferSelect;
