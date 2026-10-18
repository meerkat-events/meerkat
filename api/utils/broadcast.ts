import { supabase } from "../supabase.ts";
import env from "../env.ts";
import logger from "../logger.ts";
import { type Coalescer, coalesce } from "./coalesce.ts";

const BROADCAST_EVENT = "questions";

/**
 * Each instance sends its SSE listeners at most one update per event per
 * window. Every update makes every listener refetch the question list, so
 * this caps the refetches a busy talk causes, whatever its vote rate.
 */
const SSE_UPDATE_WINDOW_MS = 1000;

/**
 * Each instance posts at most one broadcast per event per window. Shorter
 * than the SSE window: it only saves Supabase calls, and the SSE window is
 * what limits the refetches.
 */
const OUTGOING_BROADCAST_WINDOW_MS = 300;

const BROADCAST_TIMEOUT_MS = 2000;

type Listener = () => void;

const subscriptions = new Map<number, {
  channel: ReturnType<NonNullable<typeof supabase>["channel"]>;
  listeners: Set<Listener>;
  notifyListeners: Coalescer;
}>();

const outgoingBroadcasts = new Map<number, Coalescer>();

/**
 * Subscribe a local listener to questions updates for an event.
 * Shares a single Supabase channel per event across all SSE connections on
 * this instance, and coalesces its updates (`SSE_UPDATE_WINDOW_MS`).
 * Returns an unsubscribe function.
 */
export function subscribeToEventQuestions(
  eventId: number,
  listener: Listener,
): () => void {
  if (!supabase) return () => {};

  if (!subscriptions.has(eventId)) {
    const listeners = new Set<Listener>();
    const notifyListeners = coalesce(() => {
      for (const notify of listeners) notify();
    }, SSE_UPDATE_WINDOW_MS);
    const channel = supabase
      .channel(`event-${eventId}`)
      .on("broadcast", { event: BROADCAST_EVENT }, () => {
        notifyListeners.trigger();
      })
      .subscribe();
    subscriptions.set(eventId, { channel, listeners, notifyListeners });
  }

  subscriptions.get(eventId)!.listeners.add(listener);

  return () => {
    const entry = subscriptions.get(eventId);
    if (!entry) return;
    entry.listeners.delete(listener);
    if (entry.listeners.size === 0) {
      entry.notifyListeners.cancel();
      supabase!.removeChannel(entry.channel);
      subscriptions.delete(eventId);
    }
  };
}

/**
 * Broadcast a questions-updated signal for an event to all subscribers.
 *
 * Doesn't block the request: the broadcast is coalesced per event
 * (`OUTGOING_BROADCAST_WINDOW_MS`) and sent in the background, and a failure
 * is only logged.
 */
export function broadcastQuestionsUpdate(eventId: number): void {
  if (!supabase || !env.supabaseUrl || !env.supabaseServiceRoleKey) return;

  let broadcast = outgoingBroadcasts.get(eventId);
  if (!broadcast) {
    broadcast = coalesce(
      () => void postBroadcast(eventId),
      OUTGOING_BROADCAST_WINDOW_MS,
      () => outgoingBroadcasts.delete(eventId),
    );
    outgoingBroadcasts.set(eventId, broadcast);
  }
  broadcast.trigger();
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
