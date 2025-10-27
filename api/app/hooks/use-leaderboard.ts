import useSWR from "swr";
import { fetcher } from "./fetcher.ts";
import { HTTPError } from "./http-error.ts";

export function useLeaderboard() {
  const { data, ...rest } = useSWR<
    { data: { name: string; points: number; rank: number }[] },
    HTTPError
  >("/api/v1/users/leaderboard", fetcher);
  return {
    data: data?.data,
    ...rest,
  };
}
