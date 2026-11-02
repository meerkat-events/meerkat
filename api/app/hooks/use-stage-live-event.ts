import useSWR, { type SWRConfiguration } from "swr";
import type { Event } from "../types.ts";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";

type StageLiveEventResponse = { data: Event };

/**
 * The event a stage's signage shows (live, else running, else next, else the
 * one that ended last), polled every 30 seconds as a fallback: a moderator
 * putting an event live reaches the screen through the stream's `live`
 * message within a second. Keeps polling while the page is hidden: a
 * captured stage screen counts as hidden.
 */
export function useStageLiveEvent(
  stage: string | undefined,
  options?: { swr?: SWRConfiguration<StageLiveEventResponse, HTTPError> },
) {
  return useSWR<StageLiveEventResponse, HTTPError>(
    stage ? `/api/v1/events/stage/${encodeURIComponent(stage)}/live` : null,
    fetcher,
    {
      refreshInterval: 30_000,
      refreshWhenHidden: true,
      ...options?.swr,
    },
  );
}
