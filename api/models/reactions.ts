import { and, asc, eq, gt } from "drizzle-orm";
import db from "../db.ts";
import { reactions } from "../schema.ts";
import type { ReactionEmoji } from "../reactions.ts";

export async function createReaction(
  { eventId, userId, uid, emoji }: {
    eventId: number;
    userId: string;
    uid: string;
    emoji: ReactionEmoji;
  },
): Promise<Reaction> {
  const [newReaction] = await db.insert(reactions).values({
    eventId: eventId,
    userId: userId,
    uid: uid,
    emoji: emoji,
  }).returning().execute();

  if (!newReaction) throw new Error("Failed to create reaction");
  return newReaction;
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
