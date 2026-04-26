import { eq } from "drizzle-orm";
import { conferences } from "../schema.ts";
import db from "../db.ts";

export type Conference = typeof conferences.$inferSelect;

export async function getConferenceById(
  id: number,
): Promise<Conference | null> {
  const results = await db.select().from(conferences).where(
    eq(conferences.id, id),
  ).limit(1);

  return results.at(0) ?? null;
}

export function getConferences(): Promise<Conference[]> {
  return db.select().from(conferences).execute();
}

export async function createConference(
  newConference: typeof conferences.$inferInsert,
): Promise<Conference> {
  const result = await db.insert(conferences).values(newConference)
    .returning().execute();

  const conference = result.at(0);
  if (!conference) throw new Error("Failed to create conference");
  return conference;
}
