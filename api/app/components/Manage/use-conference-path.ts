import { useSearchParams } from "react-router";

/**
 * Adds the conference being viewed (`?conference=<id>`) to a management path,
 * so links between pages stay on it instead of going back to the first one.
 */
export function useConferencePath() {
  const [params] = useSearchParams();
  const conference = params.get("conference");

  return (path: string) =>
    conference
      ? `${path}${path.includes("?") ? "&" : "?"}conference=${encodeURIComponent(conference)}`
      : path;
}
