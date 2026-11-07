import { and, eq, gt, sql } from "drizzle-orm";
import db from "../db.ts";
import { supervoteBalances, votes } from "../schema.ts";

/** The weight of a supervote; a regular vote weighs 1. */
export const SUPERVOTE_WEIGHT = 3;

type Tx = Parameters<Parameters<typeof db["transaction"]>[0]>[0];

/** Supervotes the user can spend, in any conference. */
export async function getSupervoteBalance(userId: string) {
  const [row] = await db.select({ balance: supervoteBalances.balance })
    .from(supervoteBalances)
    .where(eq(supervoteBalances.userId, userId))
    .execute();

  return row?.balance ?? 0;
}

/**
 * Gives the user one supervote, for a selected question. Runs inside the
 * caller's transaction.
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
 * Spends one of the user's supervotes on a new vote, in one transaction.
 * The balance only drops while it is above 0, and the update locks the
 * user's balance row, so two quick taps can't both spend the last one.
 * A supervote is spent once: it can't be removed (the upvote toggle answers
 * 409) and is never refunded. Returns false when there's none left to spend.
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
