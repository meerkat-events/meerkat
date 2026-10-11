import useSWR from "swr";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";
import { useAuth } from "./use-auth.ts";

export type Supervotes = {
  /** Supervotes the user can spend, in any conference. */
  available: number;
  /** The weight of a supervoted upvote, e.g. 3 (a regular one weighs 1). */
  weight: number;
};

/**
 * The signed-in user's supervotes. Pass `enabled` from the conference's
 * `supervotes` feature, so conferences without it don't fetch.
 */
export function useSupervotes(enabled: boolean) {
  const { isAuthenticated, session } = useAuth();
  const accessToken = session?.access_token;

  // The token is part of the key, so switching accounts never shows the
  // previous user's cached balance.
  const { data, error, isLoading, mutate } = useSWR<
    { data: Supervotes },
    HTTPError,
    [string, string | undefined] | null
  >(
    isAuthenticated && enabled
      ? ["/api/v1/users/me/supervotes", accessToken]
      : null,
    ([path, token]) => fetcher(path, token),
  );

  return { data: data?.data, error, isLoading, mutate };
}
