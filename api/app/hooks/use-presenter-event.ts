import { useMemo } from "react";
import { useJitteredRefresh } from "@meerkat-events/react";
import { useEvent } from "./use-event.ts";
import { toEvent } from "../lib/event.ts";
import type { Event } from "../types.ts";

// The presenter view refetches the whole event on an SSE update, paced like
// every other client (useJitteredRefresh: one refetch at a time), within a
// second.
const REFRESH_MAX_DELAY_MS = 1000;

/**
 * The event a presenter view shows, starting from the one its route's
 * `loader` rendered on the server (no fetch on load), refreshed every 10
 * seconds, and `scheduleRefresh` for its stream's updates.
 */
export function usePresenterEvent(initialEvent: Event) {
  const { data, mutate } = useEvent(initialEvent.uid, {
    swr: {
      fallbackData: { data: initialEvent },
      revalidateOnMount: false,
      refreshInterval: 10_000,
    },
  });

  const eventData = data?.data ?? initialEvent;
  const event = useMemo(() => toEvent(eventData), [eventData]);

  const scheduleRefresh = useJitteredRefresh(
    () => mutate(),
    REFRESH_MAX_DELAY_MS,
  );

  return { event, scheduleRefresh };
}
