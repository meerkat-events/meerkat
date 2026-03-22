import { supabase } from "../supabase.ts";
import env from "../env.ts";

const BROADCAST_EVENT = "questions";

type Listener = () => void;

const subscriptions = new Map<number, {
  channel: ReturnType<NonNullable<typeof supabase>["channel"]>;
  listeners: Set<Listener>;
}>();

/**
 * Subscribe a local listener to questions updates for an event.
 * Shares a single Supabase channel per event across all SSE connections on
 * this instance. Returns an unsubscribe function.
 */
export function subscribeToEventQuestions(
  eventId: number,
  listener: Listener,
): () => void {
  if (!supabase) return () => {};

  if (!subscriptions.has(eventId)) {
    const channel = supabase
      .channel(`event-${eventId}`)
      .on("broadcast", { event: BROADCAST_EVENT }, () => {
        subscriptions.get(eventId)?.listeners.forEach((l) => l());
      })
      .subscribe();
    subscriptions.set(eventId, { channel, listeners: new Set() });
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

/** Broadcast a questions-updated signal for an event to all subscribers. */
export async function broadcastQuestionsUpdate(eventId: number): Promise<void> {
  if (!supabase || !env.supabaseUrl || !env.supabaseServiceRoleKey) return;

  // Use the REST broadcast API — works without a WebSocket subscription and
  // supports horizontal scaling (all server instances receive via their own
  // Supabase channel subscriptions).
  await fetch(`${env.supabaseUrl}/realtime/v1/api/broadcast`, {
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
  });
}
