import useSWR from "swr";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";
import type { Participant, PointsScoring } from "../types.ts";

export const participantUrl = (conferenceId: number, userId: string) =>
  `/api/v1/conferences/${conferenceId}/participants/${userId}`;

/**
 * Someone's points and tier at a conference. Nothing is fetched until both
 * ids are set, so callers mount it only once a profile is opened.
 */
export function useParticipant(
  conferenceId: number | undefined,
  userId: string | undefined,
) {
  const { data, error, isLoading } = useSWR<
    { data: Participant; scoring: PointsScoring },
    HTTPError
  >(
    conferenceId !== undefined && userId
      ? participantUrl(conferenceId, userId)
      : undefined,
    fetcher,
  );

  return { data: data?.data, scoring: data?.scoring, error, isLoading };
}
