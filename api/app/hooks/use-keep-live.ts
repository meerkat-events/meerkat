import type { Event } from "../types.ts";
import useSWR from "swr";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";

export type UseKeepLiveProps = {
  event?: Event | undefined;
  onUpdate?: (newEvent: Event) => void;
};

/**
 * Follows the stage's live event for signage: polls every 10 seconds and
 * calls `onUpdate` when another event of the stage is live.
 */
export function useKeepLive({ event, onUpdate }: UseKeepLiveProps) {
  useSWR<
    { data: Event | undefined },
    HTTPError
  >(
    event ? `/api/v1/events/stage/${event.stage}/live` : undefined,
    fetcher,
    {
      refreshInterval: 10_000,
      onSuccess: (data) => {
        if (!event || !data.data) return;
        if (event.uid !== data.data.uid) {
          onUpdate?.(data.data);
        }
      },
    },
  );
}
