import logger from "../logger.ts";
import type { PublicReaction, PublishedMessage } from "./bus.ts";
import { bus } from "./index.ts";

type EventIds = { id: number; conferenceId: number };

/**
 * Tells every instance that an event's questions or votes changed, so its
 * Q&A pages, presenter view and the conference's management pages refetch.
 */
export async function notifyQuestionsChanged(event: EventIds) {
  await publish({
    type: "questions",
    eventId: event.id,
    conferenceId: event.conferenceId,
  });
}

/** Sends a reaction to every Q&A page and presenter view of the event. */
export async function notifyReaction(
  event: EventIds,
  reaction: PublicReaction,
) {
  await publish({ type: "reaction", eventId: event.id, reaction });
}

/** Switches the stage's screens (presenter views in keep-live mode). */
export async function notifyEventLive(
  event: { id: number; uid: string; stage: string },
) {
  await publish({
    type: "live",
    eventId: event.id,
    eventUid: event.uid,
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
