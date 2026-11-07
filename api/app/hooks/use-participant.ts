import useSWR from "swr";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";
import { useAuth } from "./use-auth.ts";
import { useRefetchOnTokenRefresh } from "./use-refetch-on-token-refresh.ts";
import type { Participant, PointsScoring } from "../types.ts";

export const participantUrl = (conferenceId: number, userId: string) =>
  `/api/v1/conferences/${conferenceId}/participants/${userId}`;

/**
 * Someone's points and tier at a conference, for signed-in users. Nothing is
 * fetched until both ids and a session are there, so callers mount it only
 * once a profile is opened.
 */
export function useParticipant(
  conferenceId: number | undefined,
  userId: string | undefined,
) {
  const { session } = useAuth();
  const token = session?.access_token;
  const viewerId = session?.user.id;

  // Keyed on the viewer rather than the token, which changes on every
  // refresh and would blank the open profile.
  const { data, error, isLoading, mutate } = useSWR<
    { data: Participant; scoring: PointsScoring },
    HTTPError
  >(
    conferenceId !== undefined && userId && token && viewerId
      ? [participantUrl(conferenceId, userId), viewerId]
      : undefined,
    ([path]: [string, string]) => fetcher(path, token),
  );
  useRefetchOnTokenRefresh(token, mutate);

  return { data: data?.data, scoring: data?.scoring, error, isLoading };
}
