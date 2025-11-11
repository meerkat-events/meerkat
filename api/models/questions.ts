import { and, asc, desc, eq, isNull, lte, not, or, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { questions, users, votes } from "../schema.ts";
import db from "../db.ts";

export const Sorts = ["popular", "newest"] as const;
export type Sort = (typeof Sorts)[number];

const votesSnippet = sql`COUNT(${votes.questionId})`.mapWith(Number).as(
  "votes",
);

export function getQuestions(
  eventId: number,
  sort: Sort = "popular",
  answered?: boolean,
) {
  const orderBy = sort === "popular"
    ? [
      sql`${questions.answeredAt} DESC NULLs FIRST`,
      desc(votesSnippet),
      asc(questions.createdAt),
    ]
    : [desc(questions.createdAt)];

  const conditions = [
    eq(questions.eventId, eventId),
    or(isNull(users.bannedUntil), lte(users.bannedUntil, new Date())),
    isNull(questions.deletedAt),
  ];

  if (answered === true) {
    conditions.push(not(isNull(questions.answeredAt)));
  } else if (answered === false) {
    conditions.push(isNull(questions.answeredAt));
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
      userId: questions.userId,
      userMetadata: users.userMetadata,
      user: users,
      votes: votesSnippet,
    })
    .from(questions)
    .leftJoin(votes, eq(questions.id, votes.questionId))
    .leftJoin(users, eq(questions.userId, users.id))
    .where(
      and(...conditions),
    )
    .groupBy(questions.id, users.id)
    .orderBy(...orderBy)
    .execute();
}

export async function createQuestion(
  question: Omit<
    Question,
    "uid" | "createdAt" | "id" | "answeredAt" | "selectedAt" | "deletedAt"
  >,
) {
  const result = await db.insert(questions).values({
    ...question,
    uid: uuidv7(),
  }).returning().execute();

  if (result.length !== 1) {
    throw new Error("Failed to create question");
  }

  return result[0];
}

export async function getQuestionByUID(uid: string) {
  const result = await db.select().from(questions).where(
    eq(questions.uid, uid),
  );

  return result.length === 1 ? result[0] : null;
}

export async function selectQuestion(id: number) {
  const result = await db.update(questions).set({
    selectedAt: new Date(),
  }).where(eq(questions.id, id)).returning().execute();

  return result.length === 1 ? result[0] : null;
}

export async function markAsAnswered(
  id: number,
) {
  const results = await db.update(questions).set({
    answeredAt: new Date(),
  }).where(
    eq(questions.id, id),
  ).returning().execute();

  return results.length === 1 ? results[0] : null;
}

export async function deleteQuestion(id: number) {
  const results = await db.update(questions).set({
    deletedAt: new Date(),
  }).where(eq(questions.id, id)).returning().execute();

  return results.length === 1 ? results[0] : null;
}

export type Question = typeof questions.$inferSelect;
export type QuestionWithVotes = Question & { votes: number };
