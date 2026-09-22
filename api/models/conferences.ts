import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
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

export const PRETALX_SYNC_COOLDOWN_SECONDS = 60;

const cooldown = sql.raw(`interval '${PRETALX_SYNC_COOLDOWN_SECONDS} seconds'`);

/**
 * Claims the right to sync the conference linked to a Pretalx event by
 * stamping `pretalx_synced_at`, at most once per cooldown across all
 * instances. Returns null for an unknown event, otherwise whether the claim
 * succeeded and, if not, the seconds until the cooldown ends.
 */
export async function claimPretalxSync(pretalxEvent: string): Promise<
  | { claimed: true; conferenceId: number }
  | { claimed: false; conferenceId: number; retryAfter: number }
  | null
> {
  const [claimed] = await db.update(conferences)
    .set({ pretalxSyncedAt: sql`now()` })
    .where(and(
      eq(conferences.pretalxEvent, pretalxEvent),
      or(
        isNull(conferences.pretalxSyncedAt),
        lt(conferences.pretalxSyncedAt, sql`now() - ${cooldown}`),
      ),
    ))
    .returning({ id: conferences.id });

  if (claimed) return { claimed: true, conferenceId: claimed.id };

  const [throttled] = await db.select({
    id: conferences.id,
    retryAfter: sql<number>`greatest(1, ceil(extract(epoch from
      ${conferences.pretalxSyncedAt} + ${cooldown} - now())))::int`,
  }).from(conferences).where(eq(conferences.pretalxEvent, pretalxEvent));

  return throttled
    ? {
      claimed: false,
      conferenceId: throttled.id,
      retryAfter: throttled.retryAfter,
    }
    : null;
}
