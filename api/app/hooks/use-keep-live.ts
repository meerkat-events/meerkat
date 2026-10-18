import type { Event } from "../types.ts";
import useSWRSubscription from "swr/subscription";
import { useSupabase } from "../context/supabase.tsx";
import useSWR from "swr";
import { useRef } from "react";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";
import { LIVE_EVENT, parseLiveEventMessage } from "../../live-event.ts";

export type UseKeepLiveProps = {
  event?: Event | undefined;
  onUpdate?: (eventUid: string) => void;
};

export function useKeepLive({ event, onUpdate }: UseKeepLiveProps) {
  const { client: supabase } = useSupabase();

  // The subscription lives as long as the stage stays the same, so its
  // callback reads the current event and callback through refs.
  const eventUidRef = useRef(event?.uid);
  eventUidRef.current = event?.uid;
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const followLiveEvent = (eventUid: string) => {
    if (eventUidRef.current === undefined) return;
    if (eventUidRef.current === eventUid) return;
    onUpdateRef.current?.(eventUid);
  };

  useSWR<
    { data: Event | undefined },
    HTTPError
  >(
    event ? `/api/v1/events/stage/${event.stage}/live` : undefined,
    fetcher,
    {
      refreshInterval: 10_000,
      onSuccess: (data) => {
        if (!data.data) return;
        followLiveEvent(data.data.uid);
      },
    },
  );

  return useSWRSubscription(
    supabase && event ? `stage-${event.stage}` : undefined,
    (key) => {
      const channel = supabase?.channel(key)
        .on(
          "broadcast",
          {
            event: LIVE_EVENT,
          },
          (message) => {
            const liveEvent = parseLiveEventMessage(message["payload"]);
            if (!liveEvent) return;
            followLiveEvent(liveEvent.eventUid);
          },
        )
        .subscribe();

      return () => {
        channel?.unsubscribe();
      };
    },
  );
}
