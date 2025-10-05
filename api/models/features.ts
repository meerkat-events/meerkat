import { eq } from "drizzle-orm";
import db from "../db.ts";
import { features } from "../schema.ts";

export function getFeatures(conferenceId: number) {
  return db.select().from(features).where(
    eq(features.conferenceId, conferenceId),
  ).execute();
}

export type Feature = typeof features.$inferSelect;
