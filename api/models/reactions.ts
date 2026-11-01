import { and, asc, eq, gt } from "drizzle-orm";
import db from "../db.ts";
import { reactions } from "../schema.ts";
import type { ReactionEmoji } from "../reactions.ts";

/**
 * Inserts the reaction, or returns null when a reaction with this `uid`
 * already exists (whoever sent it). The client picks the `uid`, so two
 * requests racing with the same one must not fail on the primary key.
 */
export async function createReaction(
  { eventId, userId, uid, emoji }: {
    eventId: number;
    userId: string;
    uid: string;
    emoji: ReactionEmoji;
  },
): Promise<Reaction | null> {
  const [newReaction] = await db.insert(reactions).values({
    eventId: eventId,
    userId: userId,
    uid: uid,
    emoji: emoji,
  })
    .onConflictDoNothing({ target: reactions.uid })
    .returning()
    .execute();

  return newReaction ?? null;
}

export async function getReactionByUid(
  uid: string,
): Promise<Reaction | undefined> {
  const [reaction] = await db.select().from(reactions)
    .where(eq(reactions.uid, uid))
    .execute();
  return reaction;
}

/**
 * When the user sent each reaction since `date`, oldest first. A rate limit
 * over that window frees up as they leave it.
 */
export async function getUserReactionTimesAfterDate(
  userId: string,
  date: Date,
): Promise<Date[]> {
  const result = await db
    .select({ createdAt: reactions.createdAt })
    .from(reactions)
    .where(
      and(
        eq(reactions.userId, userId),
        gt(reactions.createdAt, date),
      ),
    )
    .orderBy(asc(reactions.createdAt))
    .execute();

  return result.map((row) => row.createdAt);
}

export type Reaction = typeof reactions.$inferSelect;
