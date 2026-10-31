import type { Reaction } from "../types.ts";

/** The `live` event's data: the session just put live on this stage. */
export type LiveSession = { uid: string; title: string };

export type EventStreamCallbacks = {
  onReaction?: ((reaction: Reaction) => void) | undefined;
  onEventLive?: ((session: LiveSession) => void) | undefined;
};

/**
 * Handlers for the named events of an event's question stream
 * (`/api/v1/events/:uid/questions/stream`, see routes/events.ts), for
 * `useEventSource`'s `events` option. Reads the callbacks through `ref`, so
 * the handlers stay the same object across renders and the stream doesn't
 * reconnect.
 */
export function eventStreamEvents(
  ref: { readonly current: EventStreamCallbacks },
) {
  return {
    reaction: (data: string) => {
      ref.current.onReaction?.(JSON.parse(data) as Reaction);
    },
    live: (data: string) => {
      ref.current.onEventLive?.(JSON.parse(data) as LiveSession);
    },
  };
}
