import { and, eq, gt, sql } from "drizzle-orm";
import db from "../db.ts";
import { questions, votes } from "../schema.ts";
import { Question } from "./questions.ts";

export async function createVote(
  questionId: number,
  userId: string,
): Promise<Vote> {
  const [newVote] = await db.insert(votes).values({
    questionId: questionId,
    userId: userId,
    createdAt: new Date(),
  }).execute();

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

export async function getUserVoteCountAfterDate(
  userId: string,
  eventId: number,
  date: Date,
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
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

  return Number(result[0].count);
}

export type Vote = typeof votes.$inferSelect;
