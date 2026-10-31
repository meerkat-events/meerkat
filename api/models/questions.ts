import {
  and,
  asc,
  desc,
  eq,
  isNotNull,
  isNull,
  lte,
  not,
  or,
  sql,
} from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { events, questions, users, votes } from "../schema.ts";
import db from "../db.ts";
import { addSupervote, refundSupervotes } from "./supervotes.ts";
import { voteTotal } from "./votes.ts";

export const Sorts = ["popular", "newest"] as const;
export type Sort = (typeof Sorts)[number];


export type Questions = Awaited<ReturnType<typeof getQuestions>>;

/**
 * Visible questions of an event. Questions hidden by automatic moderation are
 * left out, except for their author: pass the viewer's user id so their own
 * hidden questions appear among the rest, as if nothing had happened. With a
 * viewer, each question also carries the weight of the viewer's vote on it
 * (`viewerVoteWeight`, null when they haven't voted).
 */
export function getQuestions(
  eventId: number,
  sort: Sort = "popular",
  answered?: boolean,
  viewerId?: string,
) {
  const orderBy = sort === "popular"
    ? [
      sql`${questions.answeredAt} DESC NULLs FIRST`,
      desc(voteTotal),
      asc(questions.createdAt),
    ]
    : [desc(questions.createdAt)];

  const visibleToViewer = viewerId
    ? or(isNull(questions.hiddenAt), eq(questions.userId, viewerId))
    : isNull(questions.hiddenAt);

  const conditions = [
    eq(questions.eventId, eventId),
    or(isNull(users.bannedUntil), lte(users.bannedUntil, new Date())),
    isNull(questions.deletedAt),
    visibleToViewer,
  ];

  if (answered === true) {
    conditions.push(not(isNull(questions.answeredAt)));
  } else if (answered === false) {
    conditions.push(isNull(questions.answeredAt));
  }

  const where = and(...conditions);

  const viewerVoteWeight = viewerId
    ? sql<number | null>`MAX(${votes.weight}) FILTER (WHERE ${votes.userId} = ${viewerId})`
    : sql<null>`NULL`;

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
      user: users,
      votes: voteTotal,
      viewerVoteWeight: viewerVoteWeight.as("viewer_vote_weight"),
    })
    .from(questions)
    .leftJoin(votes, eq(questions.id, votes.questionId))
    .leftJoin(users, eq(questions.userId, users.id))
    .where(where)
    .groupBy(questions.id, users.id)
    .orderBy(...orderBy)
    .execute();
}

export async function createQuestion(
  question: Omit<typeof questions.$inferInsert, "uid">,
) {
  const result = await db.insert(questions).values({
    ...question,
    uid: uuidv7(),
  }).returning().execute();

  const created = result.at(0);
  if (!created) throw new Error("Failed to create question");
  return created;
}

/**
 * The events a user has (not deleted) questions in, for telling their lists
 * when the user is blocked and the questions disappear.
 */
export async function getEventsWithQuestionsBy(userId: string) {
  return await db.selectDistinct({
    id: events.id,
    conferenceId: events.conferenceId,
  })
    .from(questions)
    .innerJoin(events, eq(events.id, questions.eventId))
    .where(and(eq(questions.userId, userId), isNull(questions.deletedAt)));
}

export async function getQuestionByUID(uid: string) {
  const result = await db.select().from(questions).where(
    eq(questions.uid, uid),
  );

  return result.at(0) ?? null;
}

/**
 * Puts a question on stage and marks the previous selection answered. With
 * `earnsSupervote`, the author gets a supervote the first time the question
 * is selected.
 */
export async function selectQuestion(
  id: number,
  { earnsSupervote }: { earnsSupervote: boolean },
) {
  const result = await db.transaction(async (tx) => {
    // Locked, so two concurrent selects can't both award the supervote.
    const [previous] = await tx.select({ selectedAt: questions.selectedAt })
      .from(questions)
      .where(eq(questions.id, id))
      .for("update")
      .execute();
    if (!previous) return null;

    const result = await tx.update(questions).set({
      selectedAt: new Date(),
    }).where(eq(questions.id, id)).returning().execute();

    const question = result.at(0);
    if (!question) return null;

    await tx.update(questions).set({
      answeredAt: new Date(),
    }).where(
      and(
        not(eq(questions.id, question.id)),
        eq(questions.eventId, question.eventId),
        isNotNull(questions.selectedAt),
      ),
    ).execute();

    if (earnsSupervote && !previous.selectedAt) {
      await addSupervote(tx, question.userId);
    }

    return question;
  });

  return result;
}

export async function getSelectedQuestion(eventId: number) {
  const unansweredQuestions = await getQuestions(eventId, "popular", false);

  // Selecting answers the previous selection, but two concurrent selects can
  // leave two questions selected; the latest one is on stage.
  let selected: Questions[number] | null = null;
  for (const question of unansweredQuestions) {
    if (!question.selectedAt) continue;
    if (!selected?.selectedAt || question.selectedAt > selected.selectedAt) {
      selected = question;
    }
  }

  return selected;
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

/**
 * Soft-deletes a question and refunds the supervotes spent on it. Deleting
 * an already deleted question changes nothing and refunds nothing.
 */
export function deleteQuestion(id: number) {
  return db.transaction(async (tx) => {
    const [deleted] = await tx.update(questions).set({
      deletedAt: new Date(),
    }).where(
      and(eq(questions.id, id), isNull(questions.deletedAt)),
    ).returning().execute();

    if (!deleted) {
      const [existing] = await tx.select().from(questions)
        .where(eq(questions.id, id))
        .execute();
      return existing ?? null;
    }

    await refundSupervotes(tx, deleted.id);
    return deleted;
  });
}

/**
 * Shows a question automatic moderation hid. Its verdict stays in
 * `moderation`, so a hide decision without `hiddenAt` reads as restored.
 */
export async function restoreQuestion(id: number) {
  const results = await db.update(questions).set({
    hiddenAt: null,
  }).where(eq(questions.id, id)).returning().execute();

  return results.length === 1 ? results[0] : null;
}

export type Question = typeof questions.$inferSelect;

/**
 * A question row as clients receive it: without internal ids and without the
 * moderation fields, which must never tell an author that their question was
 * hidden or why.
 */
export function toPublicQuestion(
  {
    id: _id,
    userId: _userId,
    hiddenAt: _hiddenAt,
    moderation: _moderation,
    ...question
  }: Question,
) {
  return question;
}
export type QuestionWithVotes = Question & { votes: number };
