import { and, eq, gt, min, sql } from "drizzle-orm";
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
 * How many reactions the user has sent since `date`, and when the oldest of
 * them was made: a rate limit over that window frees up once the oldest leaves
 * it.
 */
export async function getUserReactionCountAfterDate(
  userId: string,
  date: Date,
): Promise<{ count: number; oldest: Date | null }> {
  const result = await db
    .select({ count: sql<number>`count(*)`, oldest: min(reactions.createdAt) })
    .from(reactions)
    .where(
      and(
        eq(reactions.userId, userId),
        gt(reactions.createdAt, date),
      ),
    )
    .execute();

  return {
    count: Number(result.at(0)?.count ?? 0),
    oldest: result.at(0)?.oldest ?? null,
  };
}

export type Reaction = typeof reactions.$inferSelect;
