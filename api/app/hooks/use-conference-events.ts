import { useMemo } from "react";
import useSWR from "swr";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";

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

/** Every session of a conference, refreshed every 30 seconds. */
export function useConferenceEvents(conferenceId: number | undefined) {
  const { data, error, isLoading, mutate } = useSWR<
    { data: RawSession[] },
    HTTPError
  >(
    conferenceId
      ? `/api/v1/conferences/${conferenceId}/events?limit=1000`
      : undefined,
    fetcher,
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
