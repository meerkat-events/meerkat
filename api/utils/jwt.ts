import { User } from "../models/user.ts";

export const JWT_EXPIRATION_TIME = 3 * 24 * 60 * 60; // 3 days

/**
 * Constructs a JWT payload for the given user.
 *
 * @param user - The user object for which to construct the JWT payload.
 * @returns The constructed JWT payload.
 *
 * @remarks
 * The constructed JWT payload includes the following properties:
 * - `sub`: A string representation of the user's unique identifier, prefixed with the `SUB_TYPE_ID`.
 * - `iat`: The current timestamp in seconds when the JWT was issued.
 * - `role`: The role of the user, which is set to "user".
 * - `exp`: The expiration timestamp in seconds, calculated by adding `JWT_EXPIRATION_TIME` to the current timestamp.
 */
export function constructJWTPayload(
  user: User,
) {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  return {
    sub: user.uid,
    iat: nowInSeconds,
    role: "user",
    exp: nowInSeconds + JWT_EXPIRATION_TIME,
  };
}
