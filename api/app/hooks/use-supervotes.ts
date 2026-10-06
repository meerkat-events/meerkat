import useSWR from "swr";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";
import { useAuth } from "./use-auth.ts";

export type Supervotes =
  | { enabled: false }
  | {
    enabled: true;
    /** How much a supervoted upvote counts, e.g. 3. */
    multiplier: number;
    earned: number;
    spent: number;
    available: number;
    /** Questions in this conference the user spent a supervote on. */
    questionUids: string[];
  };

/** The signed-in user's supervotes in the conference of event `uid`. */
export function useSupervotes(uid: string | undefined) {
  const { isAuthenticated, session } = useAuth();

  const { data, error, isLoading, mutate } = useSWR<
    { data: Supervotes },
    HTTPError
  >(
    isAuthenticated && uid ? `/api/v1/events/${uid}/supervotes` : undefined,
    (path: string) => fetcher(path, session?.access_token),
  );

  return { data: data?.data, error, isLoading, mutate };
}
