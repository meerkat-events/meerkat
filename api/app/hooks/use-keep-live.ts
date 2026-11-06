import type { Event } from "../types.ts";
import { useStageLiveEvent } from "./use-stage-live-event.ts";

export type UseKeepLiveProps = {
  event?: Pick<Event, "uid" | "stage"> | undefined;
  onUpdate?: (newEvent: Event) => void;
};

/**
 * Follows the stage for signage on `/e/:uid?keep-live=true`: calls
 * `onUpdate` when the stage shows another event.
 */
export function useKeepLive({ event, onUpdate }: UseKeepLiveProps) {
  useStageLiveEvent(event?.stage, {
    swr: {
      onSuccess: (data) => {
        if (!event) return;
        if (event.uid !== data.data.uid) {
          onUpdate?.(data.data);
        }
      },
    },
  });
}
