import useSWR, { type SWRConfiguration } from "swr";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";
import type { Event } from "../types.ts";

export type UseLiveEventProps = {
  conferenceId: number | undefined;
  swr?: SWRConfiguration;
};

export function useLiveEvent({ conferenceId, swr }: UseLiveEventProps) {
  const { data, error, isLoading, mutate } = useSWR<
    { data: Event | undefined },
    HTTPError
  >(
    typeof conferenceId === "number"
      ? `/api/v1/conferences/${conferenceId}/events/live`
      : undefined,
    fetcher,
    swr,
  );

  return { data: data?.data, error, isLoading, mutate };
}
