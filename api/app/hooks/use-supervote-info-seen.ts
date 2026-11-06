import { useCallback, useSyncExternalStore } from "react";
import { readStorage, writeStorage } from "../lib/storage.ts";

const STORAGE_KEY = "meerkat:supervote-info-seen";
const listeners = new Set<() => void>();

// Blocked storage reads as seen: a dot that never goes away would nag.
const read = () => {
  const stored = readStorage(STORAGE_KEY);
  return stored === undefined || stored === "1";
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * Whether the user has opened the supervote explainer, remembered in
 * localStorage. Reads as seen during SSR so the "new" dot only appears in
 * the browser.
 */
export function useSupervoteInfoSeen() {
  const seen = useSyncExternalStore(subscribe, read, () => true);
  const markSeen = useCallback(() => {
    writeStorage(STORAGE_KEY, "1");
    listeners.forEach((listener) => listener());
  }, []);
  return { seen, markSeen };
}
