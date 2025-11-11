import { and, eq, sql } from "drizzle-orm";
import { conferenceRole } from "../schema.ts";
import db from "../db.ts";

const conferenceRolesByIdStatement = db
  .select()
  .from(conferenceRole)
  .where(eq(conferenceRole.userId, sql.placeholder("user_id")))
  .prepare("conference_roles_by_user_id");

export function getConferenceRoles(
  userId: string,
): Promise<ConferenceRole[]> {
  return conferenceRolesByIdStatement.execute({ user_id: userId });
}

const conferenceRolesByUserIdAndConferenceIdStatement = db
  .select()
  .from(conferenceRole)
  .where(
    and(
      eq(conferenceRole.userId, sql.placeholder("user_id")),
      eq(conferenceRole.conferenceId, sql.placeholder("conference_id")),
    ),
  )
  .limit(1)
  .prepare("conference_roles_by_user_id_and_conference_id");

export async function getConferenceRolesForConference(
  userId: string,
  conferenceId: number,
): Promise<ConferenceRole[]> {
  const result = await conferenceRolesByUserIdAndConferenceIdStatement.execute({
    user_id: userId,
    conference_id: conferenceId,
  });

  return result;
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
