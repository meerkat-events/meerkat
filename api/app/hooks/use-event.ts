import useSWR, { type SWRConfiguration } from "swr";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";
import type { Event } from "../types.ts";

export function useEvent(
  uid: string | undefined,
  options?: { swr?: SWRConfiguration },
) {
  return useSWR<{ data: Event }, HTTPError>(
    uid ? `/api/v1/events/${uid}` : undefined,
    fetcher,
    options?.swr,
  );
}
