import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useSearchParams } from "react-router";
import { readStorage, writeStorage } from "../../lib/storage.ts";

const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const readStored = (storageKey: string) => readStorage(storageKey) ?? null;

// Blocked storage (private browsing): the URL still holds the choice.
const writeStored = (storageKey: string, value: string | null) => {
  writeStorage(storageKey, value);
  listeners.forEach((listener) => listener());
};

/**
 * `useUrlChoice`, remembered on the device, like the Q&A page's sort
 * (`useQuestionSort`). A `?key=` in the URL wins; a plain URL shows the
 * choice stored under `storageKey`, else the default, and gets a stored
 * choice written into it, so the URL always shows what is on screen. Only
 * choosing remembers anything: the default forgets it, and landing on a
 * link never stores.
 *
 * Storage exists only in the browser, so the server render and hydration
 * show the URL's choice or the default.
 */
export function useRememberedChoice<T extends string>(
  key: string,
  choices: readonly T[],
  fallback: T,
  storageKey: string,
): [T, (next: T) => void] {
  const [params, setParams] = useSearchParams();
  const urlChoice = choices.find((choice) => choice === params.get(key));
  const stored = useSyncExternalStore(
    subscribe,
    () => readStored(storageKey),
    () => null,
  );
  const storedChoice = choices.find((choice) => choice === stored);
  const value = urlChoice ?? storedChoice ?? fallback;

  useEffect(() => {
    if (urlChoice === undefined && storedChoice !== undefined && storedChoice !== fallback) {
      setParams((p) => {
        p.set(key, storedChoice);
        return p;
      }, { replace: true });
    }
  }, [key, urlChoice, storedChoice, fallback, setParams]);

  const set = useCallback((next: T) => {
    writeStored(storageKey, next === fallback ? null : next);
    setParams((p) => {
      if (next === fallback) p.delete(key);
      else p.set(key, next);
      return p;
    }, { replace: true });
  }, [key, fallback, storageKey, setParams]);

  return [value, set];
}
