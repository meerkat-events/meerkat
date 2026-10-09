import { and, asc, eq, gt, sql } from "drizzle-orm";
import db from "../db.ts";
import { profiles, questions, users } from "../schema.ts";

export async function getUserById(id: string) {
  const user = await db.select().from(users).where(eq(users.id, id)).limit(1)
    .execute();

  return user.length > 0 ? user[0] : null;
}

const BAN_DURATION = 1000 * 60 * 60 * 24 * 30; // 30 days

export async function markUserAsBlocked(id: string) {
  await db.update(users).set({
    bannedUntil: new Date(Date.now() + BAN_DURATION),
  }).where(
    eq(users.id, id),
  ).execute();
}

export async function updateProfile(
  userId: string,
  profile: typeof profiles.$inferInsert,
) {
  const result = await db.update(profiles).set(profile).where(
    eq(profiles.userId, userId),
  ).returning().execute();
  return result.length > 0 ? result[0] : null;
}

/**
 * When the user posted each question since `date`, oldest first. A rate limit
 * over that window frees up as they leave it.
 */
export async function getUserPostTimesAfterDate(
  userId: string,
  date: Date,
): Promise<Date[]> {
  const result = await db
    .select({ createdAt: questions.createdAt })
    .from(questions)
    .where(
      and(
        eq(questions.userId, userId),
        gt(questions.createdAt, date),
      ),
    )
    .orderBy(asc(questions.createdAt))
    .execute();

  return result.map((row) => row.createdAt);
}

export async function getUserPostCountPerTalk(
  userId: string,
  eventId: number,
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(questions)
    .where(
      and(
        eq(questions.userId, userId),
        eq(questions.eventId, eventId),
      ),
    )
    .execute();

  return Number(result.at(0)?.count ?? 0);
}

export type User = typeof users.$inferSelect;
