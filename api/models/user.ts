import { and, eq, gt, isNotNull, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import db from "../db.ts";
import { accounts, questions, reactions, users, votes } from "../schema.ts";
import { generateUsername } from "../usernames.ts";

export const ZUPASS_PROVIDER = "zupass";

const getUserByUIDPreparedStatement = db.select().from(users).leftJoin(
  accounts,
  eq(users.id, accounts.userId),
).where(
  eq(users.uid, sql.placeholder("uid")),
).limit(1).prepare("get_user_by_uid");

export async function getUserByUID(uid: string) {
  const result = await getUserByUIDPreparedStatement.execute({ uid });

  return result.length === 1 ? toUser(result[0]) : null;
}

function toUser(
  result: {
    users: typeof users.$inferSelect;
    accounts: typeof accounts.$inferSelect | null;
  },
) {
  const { users: user, accounts: account } = result;

  return { ...user, hash: account?.hash };
}

type Transaction = Parameters<Parameters<typeof db["transaction"]>[0]>[0];

async function createUserInternal(transaction: Transaction) {
  const result = await transaction.insert(users).values({
    uid: uuidv7(),
    name: generateUsername(),
  }).returning().execute();

  if (result.length !== 1) {
    throw new Error("Failed to create user");
  }

  return result[0];
}

export async function createUserFromAccount(
  { provider, id, hash }: {
    provider: string;
    id: string;
    hash: string | null;
  },
) {
  const result = await db.transaction(async (db) => {
    const user = await createUserInternal(db);

    await db.insert(accounts).values({
      provider,
      id,
      hash,
      userId: user.id,
    }).execute();

    return {
      ...user,
      hash,
    };
  });

  return result;
}

export async function getUserByProvider(provider: string, id: string) {
  const result = await db.select().from(users).innerJoin(
    accounts,
    eq(
      users.id,
      accounts.userId,
    ),
  ).where(and(eq(accounts.provider, provider), eq(accounts.id, id))).limit(1)
    .execute();

  return result.length === 1 ? result[0].users : null;
}

export async function markUserAsBlocked(id: number) {
  await db.update(users).set({ blocked: true }).where(
    eq(users.id, id),
  ).execute();
}

export async function getAccounts(userId: number) {
  const result = await db.select().from(accounts).where(
    eq(accounts.userId, userId),
  ).execute();

  return result;
}

export async function getUserPostCountAfterDate(
  userId: number,
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
  userId: number,
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

export async function updateUserEmail(userId: number, hash: string) {
  await db
    .update(accounts)
    .set({ hash })
    .where(eq(accounts.userId, userId))
    .execute();
}

export async function getUserContributionRank(
  userId: number,
): Promise<{ rank: number; points: number }> {
  const result = await db
    .select({
      rank: sql<number>`rank`,
      points: sql<number>`points`,
    })
    .from(
      sql`(
        SELECT 
          users.id,
          RANK() OVER (
            ORDER BY (
              COUNT(CASE WHEN ${questions.answeredAt} IS NOT NULL THEN 1 END) * 10 + 
              COALESCE(SUM(${sql`(SELECT COUNT(*) FROM votes WHERE votes.question_id = ${questions.id})`}), 0)
            ) DESC
          ) as rank,
          COUNT(CASE WHEN ${questions.answeredAt} IS NOT NULL THEN 1 END) * 10 + 
          COALESCE(SUM(${sql`(SELECT COUNT(*) FROM votes WHERE votes.question_id = ${questions.id})`}), 0) as points
        FROM ${users}
        LEFT JOIN ${questions} ON ${eq(users.id, questions.userId)}
        GROUP BY users.id
      ) ranks`,
    )
    .where(sql`ranks.id = ${userId}`)
    .limit(1)
    .execute();

  const row = result.length > 0 ? result[0] : null;

  return {
    rank: row ? Number(row.rank) : 0,
    points: row ? Number(row.points) : 0,
  };
}

export async function countQuestions(userId: number) {
  const result = await db.select({ count: sql<number>`count(*)` }).from(
    questions,
  ).where(eq(questions.userId, userId)).execute();
  return Number(result[0].count);
}

export async function countAnsweredQuestions(userId: number) {
  const result = await db.select({ count: sql<number>`count(*)` }).from(
    questions,
  ).where(and(eq(questions.userId, userId), isNotNull(questions.answeredAt)))
    .execute();
  return Number(result[0].count);
}

export async function countVotes(userId: number) {
  const result = await db.select({ count: sql<number>`count(*)` }).from(
    votes,
  ).where(eq(votes.userId, userId)).execute();
  return Number(result[0].count);
}

export async function countReceivedVotes(userId: number) {
  const result = await db.select({ count: sql<number>`count(*)` }).from(
    votes,
  ).innerJoin(questions, eq(votes.questionId, questions.id))
    .where(eq(questions.userId, userId))
    .execute();
  return Number(result[0].count);
}

export async function countReactions(userId: number) {
  const result = await db.select({ count: sql<number>`count(*)` }).from(
    reactions,
  ).where(eq(reactions.userId, userId)).execute();
  return Number(result[0].count);
}

export type User = typeof users.$inferSelect;
