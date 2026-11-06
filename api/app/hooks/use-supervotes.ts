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

/** The signed-in user's supervotes. */
export function useSupervotes() {
  const { session } = useAuth();
  const token = session?.access_token;
  const userId = session?.user.id;

  // Keyed on the user, so switching accounts never shows the previous user's
  // cached balance. Not on the token: it changes on every refresh, which would
  // drop the balance and unmount the supervote counter.
  const { data, error, isLoading, mutate } = useSWR<
    { data: Supervotes },
    HTTPError,
    [string, string] | null
  >(
    token && userId ? ["/api/v1/users/me/supervotes", userId] : null,
    ([path]) => fetcher(path, token),
  );

  return { data: data?.data, error, isLoading, mutate };
}
