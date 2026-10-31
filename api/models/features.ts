import { and, eq } from "drizzle-orm";
import db from "../db.ts";
import { features } from "../schema.ts";

export function getFeatures(conferenceId: number) {
  return db.select().from(features).where(
    eq(features.conferenceId, conferenceId),
  ).execute();
}

/** Whether the conference has the named feature switched on. */
export async function isFeatureActive(conferenceId: number, name: string) {
  const [feature] = await db.select({ active: features.active })
    .from(features)
    .where(
      and(
        eq(features.conferenceId, conferenceId),
        eq(features.name, name),
      ),
    )
    .execute();

  return feature?.active ?? false;
}

export type Feature = typeof features.$inferSelect;
