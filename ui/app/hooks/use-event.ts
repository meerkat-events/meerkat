import useSWR, { type SWRConfiguration } from "swr";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";
import type { Event } from "../types.ts";

export const useEvent = (
  uid: string | undefined,
  options?: { swr?: SWRConfiguration },
) => {
  const { data, error, isLoading, mutate } = useSWR<{ data: Event }, HTTPError>(
    uid ? `/api/v1/events/${uid}` : undefined,
    fetcher,
    {
      revalidateOnFocus: false,
      ...options?.swr,
    },
  );

  return { data: data?.data, error, isLoading, mutate };
};
