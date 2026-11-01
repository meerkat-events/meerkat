import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  isNull,
  ne,
  type SQL,
  sql,
} from "drizzle-orm";
import db from "../db.ts";
import { conferenceRole, invitations, users } from "../schema.ts";

export type GrantableRole = "organizer" | "moderator" | "attendee";

// Most access first; the enum's own order starts at attendee.
const byAccess = (role: typeof conferenceRole.role | typeof invitations.role) =>
  sql`case ${role} when 'organizer' then 0 when 'moderator' then 1 else 2 end`;

/**
 * The organizers and moderators of a conference, every email invited that
 * hasn't signed up yet, and how many attendees it has. Attendees can be
 * thousands, so they are listed page by page by `getConferenceAttendees`;
 * invitations are added one at a time by organizers, so stay few. People who
 * take part without a role have no row, so aren't counted.
 */
export async function getConferencePermissions(conferenceId: number) {
  const [members, invited, [attendees]] = await Promise.all([
    db
      .select({
        userId: conferenceRole.userId,
        email: users.email,
        role: conferenceRole.role,
        grantedAt: conferenceRole.grantedAt,
      })
      .from(conferenceRole)
      .innerJoin(users, eq(conferenceRole.userId, users.id))
      .where(
        and(
          eq(conferenceRole.conferenceId, conferenceId),
          ne(conferenceRole.role, "attendee"),
        ),
      )
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
    db
      .select({ count: count() })
      .from(conferenceRole)
      .where(
        and(
          eq(conferenceRole.conferenceId, conferenceId),
          eq(conferenceRole.role, "attendee"),
        ),
      )
      .execute(),
  ]);

  return {
    members,
    invitations: invited,
    attendeeCount: attendees?.count ?? 0,
  };
}

/** Where a page of attendees ends; the next page starts after it. */
export type AttendeeCursor = { grantedAt: Date; userId: string };

// Postgres keeps microseconds and a JavaScript Date only milliseconds, so
// attendees are ordered and compared by the millisecond a cursor can carry.
const grantedAtMillisecond = sql`date_trunc('milliseconds', ${conferenceRole.grantedAt})`;

/**
 * One page of a conference's attendees, the most recently added first,
 * optionally only those whose email contains `search`. Returns `next` when
 * there are more.
 */
export async function getConferenceAttendees(
  conferenceId: number,
  options: { limit: number; after?: AttendeeCursor; search?: string },
) {
  const conditions: SQL[] = [
    eq(conferenceRole.conferenceId, conferenceId),
    eq(conferenceRole.role, "attendee"),
  ];
  if (options.search) {
    conditions.push(ilike(users.email, `%${escapeLike(options.search)}%`));
  }
  if (options.after) {
    // `timestamp` columns are UTC without a zone, hence the cast.
    const grantedAt = options.after.grantedAt.toISOString();
    conditions.push(
      sql`(${grantedAtMillisecond}, ${conferenceRole.userId}) < (${grantedAt}::timestamp, ${options.after.userId}::uuid)`,
    );
  }

  // One row more than asked for tells whether there is another page.
  const rows = await db
    .select({
      userId: conferenceRole.userId,
      email: users.email,
      role: conferenceRole.role,
      grantedAt: sql<Date>`${grantedAtMillisecond}`.mapWith(
        conferenceRole.grantedAt,
      ),
    })
    .from(conferenceRole)
    .innerJoin(users, eq(conferenceRole.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(grantedAtMillisecond), desc(conferenceRole.userId))
    .limit(options.limit + 1)
    .execute();

  const attendees = rows.slice(0, options.limit);
  const last = attendees.at(-1);
  const next: AttendeeCursor | null = rows.length > options.limit && last
    ? { grantedAt: last.grantedAt, userId: last.userId }
    : null;

  return { attendees, next };
}

/** Makes `%`, `_` and `\` in a search match themselves in `ilike`. */
function escapeLike(text: string) {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
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
