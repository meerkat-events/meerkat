import { useEffect, useRef, useState } from "react";
import { createRefreshScheduler } from "./refresh-scheduler.ts";

/** Upper bound of the random wait before refetching on an SSE update. */
export const UPDATE_JITTER_MS = 500;

/**
 * Returns a stable function that refreshes after a random delay of up to
 * `maxDelayMs`, never runs two refreshes at once and collapses calls in
 * between into one follow-up (see `createRefreshScheduler`). Meant as the
 * `onMessage` of `useEventSource`, so that thousands of viewers don't refetch
 * in the same instant.
 */
export function useJitteredRefresh(
  refresh: () => Promise<unknown>,
  maxDelayMs: number = UPDATE_JITTER_MS,
): () => void {
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  const [scheduler] = useState(() =>
    createRefreshScheduler(() => refreshRef.current(), maxDelayMs)
  );

  // Drop a waiting refresh on unmount.
  useEffect(() => {
    return () => scheduler.cancel();
  }, [scheduler]);

  return scheduler.schedule;
}
