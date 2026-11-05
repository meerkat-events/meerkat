import { HTTPException } from "hono/http-exception";
import { ATTENDEES_ONLY_MESSAGE } from "../features.ts";
import { mayParticipate } from "../models/roles.ts";
import { getUserById, isBanned, type User } from "../models/user.ts";

/**
 * The user looked up for `userId`, unless there is none (401) or they are
 * blocked (403).
 */
export function requireUnblockedUser(
  user: User | null | undefined,
  userId: string,
) {
  if (!user) {
    throw new HTTPException(401, { message: `User ${userId} not found` });
  }

  if (isBanned(user)) {
    throw new HTTPException(403, { message: "User is blocked" });
  }

  return user;
}

/**
 * Throws 403 when the conference is attendees-only and the user has no role
 * there. Checked after the ban check and before the rate limits.
 */
export async function requireParticipation(
  userId: string,
  conferenceId: number,
) {
  if (!await mayParticipate(userId, conferenceId)) {
    throw new HTTPException(403, { message: ATTENDEES_ONLY_MESSAGE });
  }
}

/**
 * The user, if they may ask, vote and react in the conference: 401 for an
 * unknown user, then 403 for a blocked one, then 403 for one without a role
 * in an attendees-only conference.
 */
export async function requireParticipant(userId: string, conferenceId: number) {
  const user = requireUnblockedUser(await getUserById(userId), userId);
  await requireParticipation(user.id, conferenceId);
  return user;
}
