import { useMemo } from "react";
import { useLeaderboard } from "./use-leaderboard.ts";
import {
  type LeaderboardPlace,
  rankEntries,
} from "../components/Leaderboard/podium.ts";

// Ranks move with every vote; polling keeps the badges fresh without
// refetching the conference-wide leaderboard on each real-time update.
const REFRESH_INTERVAL_MS = 30_000;

/**
 * A conference's leaderboard for the Q&A page: the ranked entries, and
 * everyone's place (with the top three's badges) keyed by user id.
 */
export function usePodiumBadges(conferenceId: number | undefined) {
  const { data, scoring, error, isLoading } = useLeaderboard(conferenceId, {
    swr: { refreshInterval: REFRESH_INTERVAL_MS },
  });

  const ranked = useMemo(() => rankEntries(data ?? []), [data]);
  const places = useMemo(
    () =>
      new Map<string, LeaderboardPlace>(
        ranked.map(({ entry, rank, badge }) => [entry.user.id, { rank, badge }]),
      ),
    [ranked],
  );

  // `isLoaded` tells "not on the podium" apart from "not fetched yet"
  return {
    data: places,
    ranked,
    scoring,
    isLoaded: data !== undefined,
    error,
    isLoading,
  };
}
