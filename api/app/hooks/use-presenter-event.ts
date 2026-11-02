import { useMemo } from "react";
import { useJitteredRefresh } from "@meerkat-events/react";
import { useEvent } from "./use-event.ts";
import { toEvent } from "../lib/event.ts";

// The presenter view refetches the whole event on an SSE update, paced like
// every other client (useJitteredRefresh: one refetch at a time), within a
// second.
const REFRESH_MAX_DELAY_MS = 1000;

/**
 * The event a presenter view shows, refreshed every 10 seconds, and
 * `scheduleRefresh` for its stream's updates. When the view moves on to
 * another event, the previous one stays on screen until the next has loaded.
 */
export function usePresenterEvent(uid: string | undefined) {
  const { data, mutate } = useEvent(uid, {
    swr: {
      refreshInterval: 10_000,
      keepPreviousData: true,
    },
  });

  const event = useMemo(() => data?.data ? toEvent(data.data) : undefined, [
    data?.data,
  ]);

  const scheduleRefresh = useJitteredRefresh(
    () => mutate(),
    REFRESH_MAX_DELAY_MS,
  );

  return { event, scheduleRefresh };
}
