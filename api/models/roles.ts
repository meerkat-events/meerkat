import { and, eq, sql } from "drizzle-orm";
import { conferenceRole, conferences } from "../schema.ts";
import db from "../db.ts";
import { ATTENDEES_ONLY_FEATURE } from "../features.ts";
import { isFeatureActive } from "./features.ts";

/**
 * Whether any of these roles may moderate the conference's Q&A: select,
 * answer and hide questions, put a session live, block someone. Organizers
 * and moderators can; only organizers see the management pages.
 */
export function canModerate(roles: { role: ConferenceRole["role"] }[]) {
  return roles.some((r) => r.role === "organizer" || r.role === "moderator");
}

export function getConferenceRoles(
  userId: string,
): Promise<
  {
    conferenceName: string | null;
    conferenceId: number;
    role: ConferenceRole["role"];
    grantedAt: Date;
  }[]
> {
  return db
    .select({
      conferenceName: conferences.name,
      conferenceId: conferenceRole.conferenceId,
      role: conferenceRole.role,
      grantedAt: conferenceRole.grantedAt,
    })
    .from(conferenceRole)
    .leftJoin(conferences, eq(conferenceRole.conferenceId, conferences.id))
    .where(eq(conferenceRole.userId, userId))
    .execute();
}

export function getConferenceRolesForConference(
  userId: string,
  conferenceId: number,
): Promise<ConferenceRole[]> {
  return db
    .select()
    .from(conferenceRole)
    .where(
      and(
        eq(conferenceRole.userId, userId),
        eq(conferenceRole.conferenceId, conferenceId),
      ),
    )
    .limit(1)
    .execute();
}

/**
 * Whether the user may ask, vote and react in the conference. Anyone signed
 * in may, unless the conference is attendees-only: then only people with a
 * role there (an invitation, or the Devcon handover) may.
 */
export async function mayParticipate(userId: string, conferenceId: number) {
  const isAttendeesOnly = await isFeatureActive(
    conferenceId,
    ATTENDEES_ONLY_FEATURE,
  );
  if (!isAttendeesOnly) {
    return true;
  }

  const roles = await getConferenceRolesForConference(userId, conferenceId);
  return roles.length > 0;
}

/**
 * Grants `role` unless the user already has a role in the conference, which
 * then stays as it is (an invited organizer opening a Devcon link, say).
 */
export function grantRoleUnlessPresent(
  userId: string,
  conferenceId: number,
  role: ConferenceRole["role"],
) {
  return db
    .insert(conferenceRole)
    .values({ userId, conferenceId, role })
    .onConflictDoNothing({
      target: [conferenceRole.userId, conferenceRole.conferenceId],
    });
}

export function grantRole(
  userId: string,
  conferenceId: number,
  role: ConferenceRole["role"],
) {
  return db
    .insert(conferenceRole)
    .values({
      userId,
      conferenceId,
      role,
    })
    .onConflictDoUpdate({
      target: [conferenceRole.userId, conferenceRole.conferenceId],
      set: { role, grantedAt: sql`now()` },
    });
}

export type ConferenceRole = typeof conferenceRole.$inferSelect;
