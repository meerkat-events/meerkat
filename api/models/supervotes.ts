import { and, eq, gt, isNotNull, isNull, sql } from "drizzle-orm";
import db from "../db.ts";
import { events, features, questions, votes } from "../schema.ts";

/** How much a supervoted upvote counts. */
export const SUPERVOTE_MULTIPLIER = 3;

/** Conference feature flag (features table) that switches supervotes on. */
export const SUPERVOTES_FEATURE = "supervotes";

type Db = typeof db;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type SupervoteBalance = {
  /** One per question of the user's an organizer selected for answering. */
  earned: number;
  /** Votes the user cast as supervotes; deleting the vote refunds it. */
  spent: number;
  available: number;
};

export async function isSupervotesEnabled(conferenceId: number) {
  const [feature] = await db.select({ active: features.active })
    .from(features)
    .where(
      and(
        eq(features.conferenceId, conferenceId),
        eq(features.name, SUPERVOTES_FEATURE),
      ),
    )
    .execute();

  return feature?.active ?? false;
}

/**
 * The user's supervotes within a conference. Derived from questions and
 * votes rather than stored, so it can't drift: selecting a question earns
 * one, a supervoted vote spends one and removing that vote refunds it.
 */
export async function getSupervoteBalance(
  userId: string,
  conferenceId: number,
  tx: Db | Tx = db,
): Promise<SupervoteBalance> {
  const [[earned], [spent]] = await Promise.all([
    tx.select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(questions)
      .innerJoin(events, eq(questions.eventId, events.id))
      .where(
        and(
          eq(questions.userId, userId),
          eq(events.conferenceId, conferenceId),
          isNotNull(questions.selectedAt),
          isNull(questions.deletedAt),
        ),
      )
      .execute(),
    tx.select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(votes)
      .innerJoin(questions, eq(votes.questionId, questions.id))
      .innerJoin(events, eq(questions.eventId, events.id))
      .where(
        and(
          eq(votes.userId, userId),
          eq(events.conferenceId, conferenceId),
          gt(votes.weight, 1),
        ),
      )
      .execute(),
  ]);

  const earnedCount = earned?.count ?? 0;
  const spentCount = spent?.count ?? 0;
  return {
    earned: earnedCount,
    spent: spentCount,
    available: Math.max(0, earnedCount - spentCount),
  };
}

/** Uids of the questions in a conference the user spent a supervote on. */
export async function getSupervotedQuestionUids(
  userId: string,
  conferenceId: number,
) {
  const rows = await db.select({ uid: questions.uid })
    .from(votes)
    .innerJoin(questions, eq(votes.questionId, questions.id))
    .innerJoin(events, eq(questions.eventId, events.id))
    .where(
      and(
        eq(votes.userId, userId),
        eq(events.conferenceId, conferenceId),
        gt(votes.weight, 1),
      ),
    )
    .execute();

  return rows.map((row) => row.uid);
}

/**
 * Casts a supervote if the user has one available. Serialized per user with
 * an advisory lock so two quick taps can't spend the same supervote twice.
 * Returns false when there's none left to spend.
 */
export function createSupervote(
  questionId: number,
  userId: string,
  conferenceId: number,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`supervote:${userId}`}))`,
    );

    const { available } = await getSupervoteBalance(userId, conferenceId, tx);
    if (available < 1) {
      return false;
    }

    await tx.insert(votes).values({
      questionId,
      userId,
      createdAt: new Date(),
      weight: SUPERVOTE_MULTIPLIER,
    }).execute();

    return true;
  });
}
