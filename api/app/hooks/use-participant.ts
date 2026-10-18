import useSWR from "swr";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";
import { useAuth } from "./use-auth.ts";
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

  const { data, error, isLoading } = useSWR<
    { data: Participant; scoring: PointsScoring },
    HTTPError
  >(
    conferenceId !== undefined && userId && token
      ? [participantUrl(conferenceId, userId), token]
      : undefined,
    ([path, token]: [string, string]) => fetcher(path, token),
  );

  return { data: data?.data, scoring: data?.scoring, error, isLoading };
}
