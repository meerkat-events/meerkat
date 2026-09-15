import useSWR from "swr";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";
import { useAuth } from "./use-auth.ts";

export type SessionCounts = {
  questions: number;
  votes: number;
  reactions: number;
  participants: number;
};

export type ConferenceStats = {
  totals: SessionCounts;
  events: (SessionCounts & { eventId: number })[];
};

/** Activity totals for a conference and each session (organizers only). */
export function useConferenceStats(conferenceId: number | undefined) {
  const { session } = useAuth();
  const token = session?.access_token;

  const { data, error, isLoading, mutate } = useSWR<
    { data: ConferenceStats },
    HTTPError
  >(
    conferenceId && token
      ? [`/api/v1/conferences/${conferenceId}/stats`, token]
      : undefined,
    ([path, token]: [string, string]) => fetcher(path, token),
    { refreshInterval: 15_000 },
  );

  return { data: data?.data, error, isLoading, mutate };
}
