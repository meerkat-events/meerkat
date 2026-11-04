import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useSearchParams } from "react-router";

export type QuestionSort = "newest" | "popular";

const STORAGE_KEY = "meerkat:qa-sort";
const listeners = new Set<() => void>();

const toQuestionSort = (value: string | null) =>
  value === "popular" || value === "newest" ? value : undefined;

/** Whether the user chose "popular" on this device. */
const readPrefersPopular = () => {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) === "popular";
  } catch {
    return false;
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * The Q&A page's sort. A `?sort=` in the URL wins; a plain URL shows the
 * sort remembered on the device, else "newest", and gets the remembered
 * "popular" written into it. Only tapping the sort control remembers
 * anything: choosing "popular" stores it for every session and conference,
 * choosing "newest" (the default) forgets it. Like the organizer pages'
 * `useUrlChoice`, the URL carries a non-default sort.
 *
 * Storage exists only in the browser, so without `?sort=` the sort is
 * `undefined` during the server render and hydration; fetch nothing until
 * it is known, or the list is fetched once per sort.
 */
export function useQuestionSort(): [
  QuestionSort | undefined,
  (next: QuestionSort) => void,
] {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSort = toQuestionSort(searchParams.get("sort"));
  // null: not known yet (server render and hydration).
  const prefersPopular = useSyncExternalStore(
    subscribe,
    readPrefersPopular,
    () => null,
  );
  const storedSort = prefersPopular === null
    ? undefined
    : prefersPopular
    ? "popular"
    : "newest";
  const sort = urlSort ?? storedSort;

  useEffect(() => {
    if (urlSort === undefined && prefersPopular) {
      setSearchParams((params) => {
        params.set("sort", "popular");
        return params;
      }, { replace: true });
    }
  }, [urlSort, prefersPopular, setSearchParams]);

  const setSort = useCallback((next: QuestionSort) => {
    try {
      if (next === "popular") {
        globalThis.localStorage?.setItem(STORAGE_KEY, next);
      } else {
        globalThis.localStorage?.removeItem(STORAGE_KEY);
      }
    } catch {
      // Blocked storage (private browsing): the URL still holds the choice.
    }
    listeners.forEach((listener) => listener());
    setSearchParams((params) => {
      if (next === "popular") params.set("sort", next);
      else params.delete("sort");
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  return [sort, setSort];
}
