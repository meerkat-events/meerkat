import useSWR from "swr";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";
import type { Event } from "../types.ts";

export function useConferenceEvents(conferenceId: number | undefined) {
  const { data, error, isLoading, mutate } = useSWR<
    { data: Event[] },
    HTTPError,
    {
      revalidateOnFocus: false;
    }
  >(
    conferenceId ? `/api/v1/conferences/${conferenceId}/events` : undefined,
    fetcher,
  );

  return { data: data?.data, error, isLoading, mutate };
}
