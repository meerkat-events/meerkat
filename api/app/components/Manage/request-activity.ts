import { useSyncExternalStore } from "react";
import type { Middleware } from "swr";

// How many SWR fetches on the management pages are in flight right now:
// polls, stream-triggered refetches and refreshes by hand alike.
let inFlight = 0;
const listeners = new Set<() => void>();

function setInFlight(count: number) {
  inFlight = count;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** SWR middleware that counts the fetches of every hook below it. */
export const trackRequests: Middleware = (useSWRNext) => (key, fetcher, config) => {
  const counted = fetcher
    ? async (...args: Parameters<typeof fetcher>) => {
      setInFlight(inFlight + 1);
      try {
        return await fetcher(...args);
      } finally {
        setInFlight(inFlight - 1);
      }
    }
    : null;
  return useSWRNext(key, counted, config);
};

/** Whether any fetch counted by `trackRequests` is in flight. */
export function useIsFetching() {
  return useSyncExternalStore(
    subscribe,
    () => inFlight > 0,
    // The server renders the pages' loading state and fetches nothing.
    () => false,
  );
}
