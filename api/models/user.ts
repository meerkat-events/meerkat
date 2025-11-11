import { and, eq, gt, sql } from "drizzle-orm";
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

export async function getUserPostCountAfterDate(
  userId: string,
  date: Date,
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(questions)
    .where(
      and(
        eq(questions.userId, userId),
        gt(questions.createdAt, date),
      ),
    )
    .execute();

  return Number(result[0].count);
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

  return Number(result[0].count);
}

export type User = typeof users.$inferSelect;
