import logger from "../logger.ts";
import type { PublicReaction, PublishedMessage } from "./bus.ts";
import { bus } from "./index.ts";

type EventIds = { id: number; conferenceId: number };

/**
 * Tells every instance that an event's questions or votes changed, so its
 * Q&A pages, presenter view and the conference's management pages refetch.
 * With `isPublic: false` (a question moderation hid on arrival) only the
 * management pages do: public lists don't change, and the public stream
 * shouldn't reveal when hidden questions arrive.
 */
export async function notifyQuestionsChanged(
  event: EventIds,
  { isPublic = true }: { isPublic?: boolean } = {},
) {
  await publish({
    type: "questions",
    eventId: event.id,
    conferenceId: event.conferenceId,
    isPublic,
  });
}

/** Sends a reaction to every Q&A page and presenter view of the event. */
export async function notifyReaction(
  event: EventIds,
  reaction: PublicReaction,
) {
  await publish({ type: "reaction", eventId: event.id, reaction });
}

/**
 * Tells the stage's screens (presenter views in keep-live mode) and Q&A pages,
 * within the event's conference, that the event is now live.
 */
export async function notifyEventLive(
  event: EventIds & { uid: string; title: string; stage: string },
) {
  await publish({
    type: "live",
    eventId: event.id,
    eventUid: event.uid,
    title: event.title,
    conferenceId: event.conferenceId,
    stage: event.stage,
  });
}

// Live updates are best effort: a failed publish is logged and never fails
// the request that changed the data.
async function publish(message: PublishedMessage) {
  try {
    await bus.publish(message);
  } catch (err) {
    logger.error(
      { err, type: message.type, eventId: message.eventId },
      "Failed to publish realtime message",
    );
  }
}
