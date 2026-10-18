// The go-live broadcast, shared by the server that sends it
// (utils/broadcast.ts) and the browser hooks that listen for it. Pure code
// without imports, so the client bundle can include it.

/** Broadcast event name on the `conference-{id}` and `stage-{stage}` topics. */
export const LIVE_EVENT = "live";

/**
 * Payload of a go-live broadcast. Anyone holding the public anon key can join
 * these topics, so it carries public identifiers only.
 */
export type LiveEventMessage = {
  eventId: number;
  eventUid: string;
};

/** Reads a received broadcast payload; null when it isn't a LiveEventMessage. */
export function parseLiveEventMessage(
  payload: unknown,
): LiveEventMessage | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const { eventId, eventUid } = payload as Record<string, unknown>;
  if (typeof eventId !== "number" || typeof eventUid !== "string") {
    return null;
  }

  return { eventId, eventUid };
}
