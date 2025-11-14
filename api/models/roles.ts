import { and, eq, sql } from "drizzle-orm";
import { conferenceRole, conferences } from "../schema.ts";
import db from "../db.ts";

export function getConferenceRoles(
  userId: string,
): Promise<
  {
    conferenceName: string | null;
    conferenceId: number;
    role: "attendee" | "speaker" | "organizer";
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
