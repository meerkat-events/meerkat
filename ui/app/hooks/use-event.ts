import useSWR from "swr";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";
import type { Event } from "../types.ts";

export const useEvent = (uid: string | undefined) => {
  const { data, error, isLoading, mutate } = useSWR<{ data: Event }, HTTPError>(
    uid ? `/api/v1/events/${uid}` : undefined,
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );

  return { data: data?.data, error, isLoading, mutate };
};
