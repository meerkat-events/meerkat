/**
 * Conference feature flag (features table) that limits asking, voting and
 * reacting to people with a role in the conference: an invitation, or the
 * Devcon handover, which grants the attendee role. Shared by the API, the
 * Q&A route's loader and the frontend, so it imports nothing.
 */
export const ATTENDEES_ONLY_FEATURE = "attendees_only";

/** The 403 message for someone without a role in an attendees-only conference. */
export const ATTENDEES_ONLY_MESSAGE = "Only conference attendees can take part";
