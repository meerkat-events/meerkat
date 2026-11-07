import { and, asc, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import db from "../db.ts";
import { questions, users } from "../schema.ts";

export async function getUserById(id: string) {
  const user = await db.select().from(users).where(eq(users.id, id)).limit(1)
    .execute();

  return user.length > 0 ? user[0] : null;
}

/** Supabase stores emails in lower case, so pass a lower-cased one. */
export async function getUserByEmail(email: string) {
  const user = await db.select().from(users).where(eq(users.email, email))
    .limit(1).execute();

  return user.length > 0 ? user[0] : null;
}

/**
 * A user's display name: the name in their metadata, or their id when they
 * have none. Public responses carry this, never the user row (it holds the
 * email).
 */
export const userName = sql<string>`COALESCE(${users.userMetadata}->>'name', ${users.id}::text)`;

/** A user's id and display name, or null when there is no such user. */
export async function getUserIdAndName(id: string) {
  const [user] = await db.select({ id: users.id, name: userName })
    .from(users)
    .where(eq(users.id, id))
    .limit(1)
    .execute();

  return user ?? null;
}

/** Whether the user is blocked right now: a block lasts until `bannedUntil`. */
export function isBanned(user: { bannedUntil: Date | null }) {
  return user.bannedUntil !== null && user.bannedUntil > new Date();
}

/**
 * Users who aren't blocked right now, for queries that join `users`; the SQL
 * twin of `isBanned`. It compares against this server's clock, not the
 * database's `NOW()`: `markUserAsBlocked` writes `bannedUntil` from this
 * clock and `isBanned` checks it against it, so a block ends at the same
 * moment in every query and in JS. Hence a function: the time is read per
 * query.
 */
export function notBanned() {
  return or(isNull(users.bannedUntil), lte(users.bannedUntil, new Date()));
}

const BAN_DURATION = 1000 * 60 * 60 * 24 * 30; // 30 days

export async function markUserAsBlocked(id: string) {
  await db.update(users).set({
    bannedUntil: new Date(Date.now() + BAN_DURATION),
  }).where(
    eq(users.id, id),
  ).execute();
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
