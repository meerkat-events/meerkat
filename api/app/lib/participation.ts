import { ATTENDEES_ONLY_FEATURE } from "../../features.ts";

type ParticipationEvent = {
  conference: { features: Record<string, boolean> };
};

/**
 * Whether the viewer may ask, vote and react on an event's Q&A page.
 *
 * Nothing is possible before the event has loaded: the mutations need its
 * uid, and only the event tells whether its conference is attendees-only,
 * where taking part also needs a role in the conference (the Devcon handover
 * or an invitation).
 */
export function canParticipate({ event, isAuthenticated, hasRoleHere }: {
  event: ParticipationEvent | undefined;
  isAuthenticated: boolean;
  hasRoleHere: boolean;
}) {
  if (!event || !isAuthenticated) {
    return false;
  }
  const isAttendeesOnly = !!event.conference.features[ATTENDEES_ONLY_FEATURE];
  return !isAttendeesOnly || hasRoleHere;
}
