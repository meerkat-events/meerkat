import { and, eq, getTableColumns, sql } from "drizzle-orm";
import { union } from "drizzle-orm/pg-core";
import db from "../db.ts";
import { events, lower, questions, votes } from "../schema.ts";
import { buildConflictUpdateColumns } from "./utils.ts";
import { DEFAULT_COVER } from "./event.ts";

export function upsertEvents(
  newEvents: typeof events.$inferInsert[],
) {
  const allColumns = getTableColumns(events);
  const updateColumns = (Object.keys(allColumns) as (keyof typeof allColumns)[])
    .filter(
      (column) =>
        !["uid", "conferenceId", "createdAt", "id"].includes(
          column,
        ),
    );

  return db.insert(events)
    .values(newEvents)
    .onConflictDoUpdate({
      target: events.uid,
      set: buildConflictUpdateColumns(events, updateColumns),
    })
    .returning()
    .execute();
}

export async function getEvents(
  conferenceId: number,
  limit: number = 100,
) {
  const results = await db.select().from(events).where(
    eq(events.conferenceId, conferenceId),
  ).orderBy(events.start).limit(limit).execute();
  return results;
}

export async function getEventByUID(uid: string) {
  const results = await db.select().from(events).where(
    eq(lower(events.uid), uid.toLowerCase()),
  ).limit(1).execute();

  const event = results.length === 1 ? results[0] : null;
  return event ? { ...event, cover: event.cover ?? DEFAULT_COVER } : null;
}

export async function getEventById(id: number) {
  const results = await db.select().from(events).where(
    eq(events.id, id),
  ).limit(1).execute();
  const event = results.length === 1 ? results[0] : null;

  if (event) {
    event.cover = event.cover ?? DEFAULT_COVER;
  }

  return event;
}

export async function countParticipants(eventId: number) {
  const results = await db.select({
    count: sql`COUNT(DISTINCT(participants.user_id))`.mapWith(
      Number,
    ),
  }).from(
    union(
      db.select({ user_id: questions.userId }).from(questions).where(
        eq(questions.eventId, eventId),
      ),
      db.select({ user_id: votes.userId }).from(votes).innerJoin(
        questions,
        eq(questions.id, votes.questionId),
      ).where(
        eq(questions.eventId, eventId),
      ),
    ).as("participants"),
  ).execute();
  return results[0].count;
}

export async function getLiveEvent(conferenceId: number) {
  const result = await db.select().from(events).where(
    and(
      eq(events.conferenceId, conferenceId),
      eq(events.live, true),
    ),
  ).limit(1).execute();
  return result.at(0);
}

export async function setEventLive(eventId: number) {
  return await db.transaction(async (tx) => {
    await tx.update(events).set({ live: false }).where(
      eq(events.live, true),
    );
    const result = await tx.update(events).set({ live: true }).where(
      eq(events.id, eventId),
    ).returning();
    return result.at(0);
  });
}

export type Event = typeof events.$inferSelect & { speaker: string | null };
