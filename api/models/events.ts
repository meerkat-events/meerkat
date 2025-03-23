import { eq, getTableColumns, inArray, sql } from "drizzle-orm";
import { union } from "drizzle-orm/pg-core";
import db from "../db.ts";
import { event_pods, events, questions, votes } from "../schema.ts";
import { buildConflictUpdateColumns } from "./utils.ts";
import { DEFAULT_COVER } from "./event.ts";
import { uuidv7 } from "uuidv7";

export async function upsertEvents(
  conferenceId: number,
  newEvents: Omit<
    Event,
    "id" | "conferenceId" | "createAt"
  >[],
) {
  const allColumns = getTableColumns(events);
  const updateColumns = (Object.keys(allColumns) as (keyof typeof allColumns)[])
    .filter(
      (column) =>
        !["uid", "conferenceId", "createdAt", "id"].includes(
          column,
        ),
    );

  const results = await db.insert(events)
    .values(
      newEvents.map((event) => ({
        ...event,
        uid: event.uid.toUpperCase(),
        conferenceId,
      })),
    )
    .onConflictDoUpdate({
      target: events.uid,
      set: buildConflictUpdateColumns(events, updateColumns),
    })
    .returning()
    .execute();
  return results;
}

export async function getEvents(conferenceId: number) {
  const results = await db.select().from(events).where(
    eq(events.conferenceId, conferenceId),
  ).orderBy(events.start).execute();
  return results;
}

const eventByUID = db.select().from(events).where(
  eq(events.uid, sql.placeholder("uid")),
).limit(1).prepare("event_by_uid");

export async function getEventByUID(uid: string) {
  const results = await eventByUID.execute({ uid: uid.toUpperCase() });
  const event = results.length === 1 ? results[0] : null;
  return event ? { ...event, cover: event.cover ?? DEFAULT_COVER } : null;
}

const eventByID = db.select().from(events).where(
  eq(events.id, sql.placeholder("id")),
).limit(1).prepare("event_by_id");

export async function getEventById(id: number) {
  const results = await eventByID.execute({ id });
  const event = results.length === 1 ? results[0] : null;
  return event ? { ...event, cover: event.cover ?? DEFAULT_COVER } : null;
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

export async function createEventPod(
  {
    eventId,
    userId,
    pod,
  }: Omit<typeof event_pods.$inferInsert, "createdAt" | "uid">,
) {
  const result = await db.insert(event_pods).values({
    uid: uuidv7(),
    eventId,
    userId,
    pod,
  }).returning()
    .execute();
  return result[0];
}

export async function getEventPods(eventUids: string[]) {
  const upperCaseEventUids = eventUids.map((uid) => uid.toUpperCase());
  const result = await db.select().from(event_pods).innerJoin(
    events,
    eq(event_pods.eventId, events.id),
  ).where(inArray(events.uid, upperCaseEventUids))
    .execute();
  return result.map(({ event_pods: pod, events }) => ({
    ...pod,
    event: events,
  }));
}

export type Event = typeof events.$inferSelect & { speaker: string | null };
