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
 * The Q&A page's sort, remembered on the device for every session and
 * conference. A `?sort=` in the URL (an old or shared link) wins over the
 * stored choice; choosing a sort stores it and drops the parameter. The
 * server doesn't know the stored choice and renders "newest"; the browser
 * switches to the stored one right after hydration.
 */
export function useQuestionSort(): [QuestionSort, (next: QuestionSort) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const stored = useSyncExternalStore(subscribe, readStored, () => undefined);
  const sort = toQuestionSort(searchParams.get("sort")) ?? stored ?? "newest";

  const setSort = useCallback((next: QuestionSort) => {
    let isStored = false;
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, next);
      isStored = globalThis.localStorage !== undefined;
    } catch {
      // Blocked storage (private browsing): the URL keeps the choice instead.
    }
    listeners.forEach((listener) => listener());
    setSearchParams((params) => {
      if (isStored) params.delete("sort");
      else params.set("sort", next);
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  return [sort, setSort];
}
