import { supabase } from "../supabase.ts";
import env from "../env.ts";
import logger from "../logger.ts";
import { LIVE_EVENT, type LiveEventMessage } from "../live-event.ts";

const BROADCAST_EVENT = "questions";

const BROADCAST_TIMEOUT_MS = 2000;

type Listener = () => void;

const subscriptions = new Map<number, {
  channel: ReturnType<NonNullable<typeof supabase>["channel"]>;
  listeners: Set<Listener>;
}>();

/**
 * Subscribe a local listener to questions updates for an event.
 * Shares a single Supabase channel per event across all SSE connections on
 * this instance. Every update reaches every listener; clients decide when to
 * refetch (`useJitteredRefresh` in `@meerkat-events/react`).
 * Returns an unsubscribe function.
 */
export function subscribeToEventQuestions(
  eventId: number,
  listener: Listener,
): () => void {
  if (!supabase) return () => {};

  if (!subscriptions.has(eventId)) {
    const listeners = new Set<Listener>();
    const channel = supabase
      .channel(`event-${eventId}`)
      .on("broadcast", { event: BROADCAST_EVENT }, () => {
        for (const notify of listeners) notify();
      })
      .subscribe();
    subscriptions.set(eventId, { channel, listeners });
  }

  subscriptions.get(eventId)!.listeners.add(listener);

  return () => {
    const entry = subscriptions.get(eventId);
    if (!entry) return;
    entry.listeners.delete(listener);
    if (entry.listeners.size === 0) {
      supabase!.removeChannel(entry.channel);
      subscriptions.delete(eventId);
    }
  };
}

/**
 * Broadcast a questions-updated signal for an event to all subscribers.
 *
 * Doesn't block the request: the broadcast is sent in the background, and a
 * failure is only logged.
 */
export function broadcastQuestionsUpdate(eventId: number): void {
  if (!supabase || !env.supabaseUrl || !env.supabaseServiceRoleKey) return;

  void postBroadcast(eventId);
}

/**
 * Use the REST broadcast API — works without a WebSocket subscription and
 * supports horizontal scaling (all server instances receive via their own
 * Supabase channel subscriptions). Never throws.
 */
async function postBroadcast(eventId: number): Promise<void> {
  try {
    const response = await fetch(
      `${env.supabaseUrl}/realtime/v1/api/broadcast`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.supabaseServiceRoleKey}`,
          "apikey": env.supabaseServiceRoleKey,
        },
        body: JSON.stringify({
          messages: [{
            topic: `event-${eventId}`,
            event: BROADCAST_EVENT,
            payload: {},
          }],
        }),
        signal: AbortSignal.timeout(BROADCAST_TIMEOUT_MS),
      },
    );
    // Release the connection; the body carries nothing we need.
    await response.body?.cancel();
    if (!response.ok) {
      logger.warn(
        { eventId, status: response.status },
        "Questions broadcast failed",
      );
    }
  } catch (error) {
    // The error's name only (TimeoutError, TypeError, …): its message and
    // cause can carry the Supabase host.
    const reason = error instanceof Error ? error.name : "unknown";
    logger.warn({ eventId, reason }, "Questions broadcast failed");
  }
}

type LiveEvent = {
  id: number;
  uid: string;
  conferenceId: number;
  stage: string;
};

/**
 * Tell the event's conference and stage that it went live, in one request to
 * the REST broadcast API (topics `conference-{id}` and `stage-{stage}`).
 * Never throws: a failed broadcast is logged, and stage screens still pick up
 * the change from their poll.
 */
export async function broadcastLiveEvent(event: LiveEvent): Promise<void> {
  if (!env.supabaseUrl) return;

  const payload: LiveEventMessage = {
    eventId: event.id,
    eventUid: event.uid,
  };

  try {
    const response = await fetch(
      `${env.supabaseUrl}/realtime/v1/api/broadcast`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.supabaseServiceRoleKey}`,
          "apikey": env.supabaseServiceRoleKey,
        },
        body: JSON.stringify({
          messages: [
            {
              topic: `conference-${event.conferenceId}`,
              event: LIVE_EVENT,
              payload,
            },
            {
              topic: `stage-${event.stage}`,
              event: LIVE_EVENT,
              payload,
            },
          ],
        }),
        signal: AbortSignal.timeout(BROADCAST_TIMEOUT_MS),
      },
    );
    await response.body?.cancel();

    if (!response.ok) {
      logger.warn(
        { eventId: event.id, status: response.status },
        "Live event broadcast failed",
      );
    }
  } catch (error) {
    // The error's name only, as in postBroadcast: its message and cause can
    // carry the Supabase host.
    const reason = error instanceof Error ? error.name : "unknown";
    logger.warn({ eventId: event.id, reason }, "Live event broadcast failed");
  }
}
