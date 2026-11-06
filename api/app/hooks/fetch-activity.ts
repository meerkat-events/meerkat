import { useSyncExternalStore } from "react";

// How many `fetcher` calls (data reads, not mutations) are in flight: polls,
// stream-triggered refetches and refreshes by hand alike.
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

/** Counts `request` as in flight until it settles. */
export async function countFetch<T>(request: () => Promise<T>): Promise<T> {
  setInFlight(inFlight + 1);
  try {
    return await request();
  } finally {
    setInFlight(inFlight - 1);
  }
}

/** Whether any data is being fetched. */
export function useIsFetching() {
  return useSyncExternalStore(
    subscribe,
    () => inFlight > 0,
    // The server renders the pages' loading state and fetches nothing.
    () => false,
  );
}
