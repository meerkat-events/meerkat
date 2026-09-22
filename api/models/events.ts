import {
  and,
  asc,
  between,
  desc,
  eq,
  getTableColumns,
  gte,
  inArray,
  ne,
  not,
  notInArray,
  sql,
} from "drizzle-orm";
import { union } from "drizzle-orm/pg-core";
import db from "../db.ts";
import { events, lower, questions, votes } from "../schema.ts";
import { buildConflictUpdateColumns } from "./utils.ts";
import { DEFAULT_COVER } from "./event.ts";

const toDay = (date: Date) => date.toISOString().slice(0, 10);

export function upsertEvents(
  newEvents: typeof events.$inferInsert[],
) {
  const allColumns = getTableColumns(events);
  const updateColumns = (Object.keys(allColumns) as (keyof typeof allColumns)[])
    .filter(
      (column) =>
        !["uid", "conferenceId", "createdAt", "id", "live"].includes(
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

const syncedColumns = [
  "title",
  "start",
  "end",
  "stage",
  "description",
  "cover",
  "speaker",
] as const;

type SyncedEvent = Omit<typeof events.$inferInsert, "conferenceId" | "live">;

/**
 * Makes a conference's events match an external schedule. Upserts `newEvents`
 * by uid, writing only rows that changed, and never touches a uid that
 * belongs to another conference (returned as `conflicts`). Deletes the
 * conference's events whose uid is not in `presentUids`, except live ones and
 * ones with questions (deleting would cascade to them); those are returned as
 * `kept`.
 */
export function syncConferenceEvents(
  conferenceId: number,
  newEvents: SyncedEvent[],
  presentUids: string[],
) {
  if (newEvents.length === 0) {
    throw new Error("syncConferenceEvents needs at least one event");
  }
  // A uid twice in one INSERT fails ON CONFLICT DO UPDATE; keep the first.
  const byUid = new Map<string, SyncedEvent>();
  for (const event of newEvents) {
    if (!byUid.has(event.uid)) byUid.set(event.uid, event);
  }
  const unique = [...byUid.values()];
  const current = sql.join(syncedColumns.map((c) => sql`${events[c]}`), sql`, `);
  const incoming = sql.join(
    syncedColumns.map((c) => sql.raw(`excluded."${events[c].name}"`)),
    sql`, `,
  );
  const uids = unique.map((event) => event.uid);
  const present = [...new Set([...presentUids, ...uids])];

  return db.transaction(async (tx) => {
    // Serialises overlapping syncs of the same conference.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('sync-events'), ${conferenceId})`,
    );

    const upserted = await tx.insert(events)
      .values(unique.map((event) => ({ ...event, conferenceId })))
      .onConflictDoUpdate({
        target: events.uid,
        set: buildConflictUpdateColumns(events, [...syncedColumns]),
        setWhere: sql`${events.conferenceId} = excluded.conference_id
          and (${current}) is distinct from (${incoming})`,
      })
      .returning({ uid: events.uid });

    const conflicts = await tx.select({ uid: events.uid }).from(events)
      .where(and(
        inArray(events.uid, uids),
        ne(events.conferenceId, conferenceId),
      ));

    const deleted = await tx.delete(events)
      .where(and(
        eq(events.conferenceId, conferenceId),
        notInArray(events.uid, present),
        eq(events.live, false),
        sql`not exists (select 1 from ${questions} where ${questions.eventId} = ${events.id})`,
      ))
      .returning({ uid: events.uid });

    const kept = await tx.select({ uid: events.uid }).from(events)
      .where(and(
        eq(events.conferenceId, conferenceId),
        notInArray(events.uid, present),
      ));

    return {
      upserted: upserted.map((event) => event.uid),
      deleted: deleted.map((event) => event.uid),
      kept: kept.map((event) => event.uid),
      conflicts: conflicts.map((event) => event.uid),
    };
  });
}

export async function getEvents(options: {
  stage?: string;
  date?: string;
  limit?: number;
  conferenceId?: number;
} = {}) {
  const conditions = [];

  if (options.stage) {
    conditions.push(eq(events.stage, options.stage));
  }
  if (options.conferenceId) {
    conditions.push(eq(events.conferenceId, options.conferenceId));
  }
  if (options.date === "upcoming" && options.stage) {
    const nextEvents = await db.select({
      start: events.start,
    }).from(events).where(
      and(
        eq(events.stage, options.stage),
        gte(events.start, new Date()),
      ),
    ).orderBy(asc(events.start)).limit(1).execute();
    const representativeDate = nextEvents.at(0)?.start ?? new Date();
    const day = toDay(representativeDate);
    const { start, end } = dateBoundaries(day);
    conditions.push(between(events.start, start, end));
  } else if (options.date) {
    const { start, end } = dateBoundaries(options.date);
    conditions.push(between(events.start, start, end));
  }

  const limit = options.limit ?? 100;

  const results = await db.select().from(events).where(
    and(...conditions),
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
  return results.at(0)?.count ?? 0;
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

export async function getStageLiveEvent(stage: string) {
  let result = await db.select().from(events).where(
    and(
      eq(events.stage, stage),
      eq(events.live, true),
    ),
  ).orderBy(desc(events.start)).limit(1).execute();

  if (result.length < 1) {
    result = await db.select().from(events).where(
      and(
        eq(events.stage, stage),
        gte(
          events.start,
          new Date(),
        ),
      ),
    ).orderBy(asc(events.start)).limit(1).execute();
  }

  return result.at(0) ?? null;
}

export async function setEventLive(eventId: number) {
  return await db.transaction(async (tx) => {
    const result = await tx.update(events).set({ live: true }).where(
      eq(events.id, eventId),
    ).returning();
    const event = result.at(0);

    if (!event) {
      throw new Error(`No event with id ${eventId}`);
    }
    await tx.update(events).set({ live: false }).where(
      and(
        eq(events.stage, event.stage),
        not(eq(events.id, event.id)),
      ),
    );

    return event;
  });
}

function dateBoundaries(date: string) {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const start = new Date(y, m - 1, d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(y, m - 1, d);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export type Event = typeof events.$inferSelect & { speaker: string | null };
