import { useCallback, useSyncExternalStore } from "react";
import { useSearchParams } from "react-router";

export type QuestionSort = "newest" | "popular";

const STORAGE_KEY = "meerkat:qa-sort";
const listeners = new Set<() => void>();

const toQuestionSort = (value: string | null | undefined) =>
  value === "popular" || value === "newest" ? value : undefined;

const readStored = () => {
  try {
    return toQuestionSort(globalThis.localStorage?.getItem(STORAGE_KEY));
  } catch {
    return undefined;
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * The Q&A page's sort. A `?sort=` in the URL wins; a plain URL shows the
 * sort remembered on the device, else "newest". Only tapping the sort
 * control remembers anything: choosing "popular" stores it for every session
 * and conference, choosing "newest" (the default) forgets it. Like the
 * organizer pages' `useUrlChoice`, the URL carries a chosen non-default sort.
 * The server doesn't know the stored choice and renders "newest"; the
 * browser switches to the stored one right after hydration.
 */
export function useQuestionSort(): [QuestionSort, (next: QuestionSort) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const stored = useSyncExternalStore(subscribe, readStored, () => undefined);
  const sort = toQuestionSort(searchParams.get("sort")) ?? stored ?? "newest";

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
