import { useSearchParams } from "react-router";

/**
 * One choice kept in the URL (`?key=value`), so a shared link opens the same
 * view. Unknown values read as the default, and the default is left out of
 * the URL to keep links short.
 */
export function useUrlChoice<T extends string>(
  key: string,
  choices: readonly T[],
  fallback: T,
): [T, (next: T) => void] {
  const [params, setParams] = useSearchParams();
  const value = choices.find((choice) => choice === params.get(key)) ?? fallback;

  const set = (next: T) =>
    setParams((p) => {
      if (next === fallback) p.delete(key);
      else p.set(key, next);
      return p;
    }, { replace: true });

  return [value, set];
}
