import useSWR from "swr";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";
import { useAuth } from "./use-auth.ts";

export type Vote = {
  questionUid: number;
  userUid: number;
  createdAt: string;
};

export function useVotes() {
  const { isAuthenticated, session } = useAuth();

  const { data, error, isLoading, mutate } = useSWR<
    { data: Vote[] },
    HTTPError
  >(
    isAuthenticated ? `/api/v1/users/me/votes` : undefined,
    (path) => fetcher(path, session?.access_token),
    { fallbackData: { data: [] } },
  );

  return { data: data?.data, error, isLoading, mutate };
}
