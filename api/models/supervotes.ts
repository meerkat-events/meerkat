import { and, eq, gt, sql } from "drizzle-orm";
import db from "../db.ts";
import { features, supervoteBalances, votes } from "../schema.ts";

/** The weight of a supervote; a regular vote weighs 1. */
export const SUPERVOTE_WEIGHT = 3;

/** Conference feature flag (features table) that switches supervotes on. */
export const SUPERVOTES_FEATURE = "supervotes";

type Tx = Parameters<Parameters<typeof db["transaction"]>[0]>[0];

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

/** Supervotes the user can spend, in any conference. */
export async function getSupervoteBalance(userId: string) {
  const [row] = await db.select({ balance: supervoteBalances.balance })
    .from(supervoteBalances)
    .where(eq(supervoteBalances.userId, userId))
    .execute();

  return row?.balance ?? 0;
}

/**
 * Gives the user one supervote. Runs inside the caller's transaction: earning
 * one for a selected question, or refunding one for a deleted question.
 */
export async function addSupervote(tx: Tx, userId: string) {
  await tx.insert(supervoteBalances)
    .values({ userId, balance: 1 })
    .onConflictDoUpdate({
      target: supervoteBalances.userId,
      set: { balance: sql`${supervoteBalances.balance} + 1` },
    })
    .execute();
}

/**
 * Refunds the supervotes spent on a question to their voters. Runs inside the
 * transaction that deletes the question.
 */
export async function refundSupervotes(tx: Tx, questionId: number) {
  const supervotes = await tx.select({ userId: votes.userId })
    .from(votes)
    .where(
      and(eq(votes.questionId, questionId), gt(votes.weight, 1)),
    )
    .execute();

  for (const supervote of supervotes) {
    await addSupervote(tx, supervote.userId);
  }
}

/**
 * Spends one of the user's supervotes on a new vote, in one transaction.
 * The balance only drops while it is above 0, and the update locks the
 * user's balance row, so two quick taps can't both spend the last one.
 * Un-voting deletes the vote but doesn't refund it: a supervote is spent
 * once. Returns false when there's none left to spend.
 */
export function spendSupervote(questionId: number, userId: string) {
  return db.transaction(async (tx) => {
    const spent = await tx.update(supervoteBalances)
      .set({ balance: sql`${supervoteBalances.balance} - 1` })
      .where(
        and(
          eq(supervoteBalances.userId, userId),
          gt(supervoteBalances.balance, 0),
        ),
      )
      .returning({ balance: supervoteBalances.balance })
      .execute();

    if (spent.length === 0) {
      return false;
    }

    await tx.insert(votes).values({
      questionId,
      userId,
      createdAt: new Date(),
      weight: SUPERVOTE_WEIGHT,
    }).execute();

    return true;
  });
}
