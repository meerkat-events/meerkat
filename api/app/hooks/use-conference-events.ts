import { useMemo } from "react";
import useSWR from "swr";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";
import { useAuth } from "./use-auth.ts";

/** A session as the events table stores it (no counts attached). */
export type Session = {
  id: number;
  uid: string;
  conferenceId: number;
  title: string;
  start: Date;
  end: Date;
  stage: string;
  speaker: string | null;
  description: string | null;
  live: boolean;
};

type RawSession = Omit<Session, "start" | "end"> & {
  start: string;
  end: string;
};

/**
 * Every session of a conference, refreshed every 30 seconds (its organizers
 * and moderators only).
 */
export function useConferenceEvents(conferenceId: number | undefined) {
  const { session } = useAuth();
  const token = session?.access_token;

  const { data, error, isLoading, mutate } = useSWR<
    { data: RawSession[] },
    HTTPError
  >(
    conferenceId && token
      ? [`/api/v1/conferences/${conferenceId}/events?limit=1000`, token]
      : undefined,
    ([path, token]: [string, string]) => fetcher(path, token),
    { refreshInterval: 30_000 },
  );

  const sessions = useMemo(
    () =>
      data?.data.map((session) => ({
        ...session,
        start: new Date(session.start),
        end: new Date(session.end),
      })),
    [data],
  );

  return { data: sessions, error, isLoading, mutate };
}
