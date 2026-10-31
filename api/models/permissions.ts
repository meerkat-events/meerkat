import { and, asc, eq, isNull, sql } from "drizzle-orm";
import db from "../db.ts";
import { conferenceRole, invitations, users } from "../schema.ts";

export type GrantableRole = "organizer" | "moderator" | "attendee";

// Most access first; the enum's own order starts at attendee.
const byAccess = (role: typeof conferenceRole.role | typeof invitations.role) =>
  sql`case ${role} when 'organizer' then 0 when 'moderator' then 1 else 2 end`;

/**
 * Everyone given a role in a conference, and the emails invited that haven't
 * signed up yet. People who only attend have no row, so aren't listed.
 */
export async function getConferencePermissions(conferenceId: number) {
  const [members, invited] = await Promise.all([
    db
      .select({
        userId: conferenceRole.userId,
        email: users.email,
        role: conferenceRole.role,
        grantedAt: conferenceRole.grantedAt,
      })
      .from(conferenceRole)
      .innerJoin(users, eq(conferenceRole.userId, users.id))
      .where(eq(conferenceRole.conferenceId, conferenceId))
      .orderBy(byAccess(conferenceRole.role), asc(users.email))
      .execute(),
    db
      .select({
        id: invitations.id,
        email: invitations.email,
        role: invitations.role,
        createdAt: invitations.createdAt,
      })
      .from(invitations)
      .where(
        and(
          eq(invitations.conferenceId, conferenceId),
          isNull(invitations.claimedAt),
        ),
      )
      .orderBy(byAccess(invitations.role), asc(invitations.email))
      .execute(),
  ]);

  return { members, invitations: invited };
}

/**
 * Invites an email without an account, or changes the role of its pending
 * invitation. `handle_new_user` turns it into a role when they sign up, and
 * fails the signup if the same email has two pending invitations to one
 * conference, so concurrent calls for an email wait for each other.
 */
export function upsertInvitation(
  conferenceId: number,
  email: string,
  role: GrantableRole,
) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(${conferenceId}, hashtext(${email}))`,
    );

    const updated = await tx
      .update(invitations)
      .set({ role })
      .where(
        and(
          eq(invitations.conferenceId, conferenceId),
          eq(invitations.email, email),
          isNull(invitations.claimedAt),
        ),
      )
      .returning({ id: invitations.id });

    if (updated.length === 0) {
      await tx.insert(invitations).values({ conferenceId, email, role });
    }
  });
}

export async function removeMember(conferenceId: number, userId: string) {
  const removed = await db
    .delete(conferenceRole)
    .where(
      and(
        eq(conferenceRole.conferenceId, conferenceId),
        eq(conferenceRole.userId, userId),
      ),
    )
    .returning({ userId: conferenceRole.userId });
  return removed.length > 0;
}

export async function removeInvitation(
  conferenceId: number,
  invitationId: number,
) {
  const removed = await db
    .delete(invitations)
    .where(
      and(
        eq(invitations.conferenceId, conferenceId),
        eq(invitations.id, invitationId),
        isNull(invitations.claimedAt),
      ),
    )
    .returning({ id: invitations.id });
  return removed.length > 0;
}
