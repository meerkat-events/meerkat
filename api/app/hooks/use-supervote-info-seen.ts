import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "meerkat:supervote-info-seen";
const listeners = new Set<() => void>();

const read = () => {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) === "1";
  } catch {
    return true;
  }
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
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, "1");
    } catch {
      // Blocked storage: the dot comes back next visit, which is harmless.
    }
    listeners.forEach((listener) => listener());
  }, []);
  return { seen, markSeen };
}
