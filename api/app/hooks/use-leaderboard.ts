import useSWR, { type SWRConfiguration } from "swr";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";

export type LeaderboardEntry = {
  user: { id: string; name: string };
  questions: number;
  picked: number;
  /** Votes on their questions, weighted (a supervote counts extra). */
  received: number;
  /** Votes they cast on other people's questions. */
  given: number;
  score: number;
};

export type LeaderboardScoring = {
  question: number;
  picked: number;
  received: number;
  given: number;
};

export function useLeaderboard(
  conferenceId: number | undefined,
  options?: { swr?: SWRConfiguration },
) {
  const { data, error, isLoading } = useSWR<
    { data: LeaderboardEntry[]; scoring: LeaderboardScoring },
    HTTPError
  >(
    conferenceId !== undefined
      ? `/api/v1/conferences/${conferenceId}/leaderboard`
      : undefined,
    fetcher,
    options?.swr,
  );

  return { data: data?.data, scoring: data?.scoring, error, isLoading };
}
