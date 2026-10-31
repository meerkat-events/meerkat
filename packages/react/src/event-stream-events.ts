/** A reaction as the session stream sends it (`event: reaction`). */
export interface StreamReaction {
  uid: string;
  emoji: string;
  createdAt: string;
}

/** A session just put live on the same stage (`event: live`). */
export interface LiveSession {
  uid: string;
  title: string;
}

export interface EventStreamCallbacks {
  onReaction?: ((reaction: StreamReaction) => void) | undefined;
  onEventLive?: ((session: LiveSession) => void) | undefined;
}

/**
 * Handlers for the named events of a session's question stream, for the
 * `events` option of `useEventSource`. Passing a new object on every render
 * is fine: `useEventSource` reads the handlers when an event arrives.
 */
export function eventStreamEvents(
  { onReaction, onEventLive }: EventStreamCallbacks,
) {
  return {
    reaction: (data: string) => {
      onReaction?.(JSON.parse(data) as StreamReaction);
    },
    live: (data: string) => {
      onEventLive?.(JSON.parse(data) as LiveSession);
    },
  };
}
