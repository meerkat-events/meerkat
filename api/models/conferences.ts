import { and, eq, isNull, or } from "drizzle-orm";
import { conferences, conferenceTickets } from "../schema.ts";
import db from "../db.ts";

export type Conference = typeof conferences.$inferSelect;

export async function getConferenceById(
  id: number,
): Promise<Conference | null> {
  const results = await db.select().from(conferences).where(
    eq(conferences.id, id),
  ).limit(1);

  return results.length === 1 ? results[0] : null;
}

export function getConferences(): Promise<Conference[]> {
  return db.select().from(conferences).execute();
}

export async function createConference(
  newConference: typeof conferences.$inferInsert,
): Promise<Conference> {
  const result = await db.insert(conferences).values(newConference)
    .returning().execute();

  if (result.length !== 1) {
    throw new Error("Failed to create conference");
  }

  return result[0];
}

export async function getConferenceByTicket(
  eventId: string,
  signerPublicKey: string,
  productId: string,
) {
  const result = await db.select().from(conferences).innerJoin(
    conferenceTickets,
    eq(conferences.id, conferenceTickets.conferenceId),
  ).where(
    and(
      eq(conferenceTickets.eventId, eventId),
      eq(conferenceTickets.signerPublicKey, signerPublicKey),
      or(
        isNull(conferenceTickets.productId),
        eq(conferenceTickets.productId, productId),
      ),
    ),
  ).limit(1).orderBy(conferenceTickets.productId).execute();

  return result.length === 1 ? result[0] : null;
}

export function getTickets(conferenceId: number) {
  return db.select().from(conferenceTickets).where(
    eq(conferenceTickets.conferenceId, conferenceId),
  ).execute();
}
