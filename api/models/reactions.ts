import { and, eq, gt, sql } from "drizzle-orm";
import db from "../db.ts";
import { reactions } from "../schema.ts";

export async function createReaction(
  { eventId, userId, uid }: { eventId: number; userId: string; uid: string },
): Promise<Reaction> {
  const [newReaction] = await db.insert(reactions).values({
    eventId: eventId,
    userId: userId,
    uid: uid,
  }).returning().execute();

  if (!newReaction) throw new Error("Failed to create reaction");
  return newReaction;
}

export async function getUserReactionCountAfterDate(
  userId: string,
  date: Date,
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(reactions)
    .where(
      and(
        eq(reactions.userId, userId),
        gt(reactions.createdAt, date),
      ),
    )
    .execute();

  return Number(result.at(0)?.count ?? 0);
}

export type Reaction = typeof reactions.$inferSelect;
