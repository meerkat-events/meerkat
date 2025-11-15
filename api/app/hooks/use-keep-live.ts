import type { Event } from "../types.ts";
import useSWRSubscription from "swr/subscription";
import { useSupabase } from "../context/supabase.tsx";
import useSWR from "swr";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";

export type UseKeepLiveProps = {
  event?: Event | undefined;
  onUpdate?: (newEvent: Event) => void;
};

export function useKeepLive({ event, onUpdate }: UseKeepLiveProps) {
  const { client: supabase } = useSupabase();

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

  return useSWRSubscription(
    supabase && event ? `stage-${event.stage}` : undefined,
    (key) => {
      const channel = supabase?.channel(key)
        .on(
          "broadcast",
          {
            event: "live",
          },
          (_payload) => {
            const newEvent = _payload.new as Event;
            onUpdate?.(newEvent);
          },
        )
        .subscribe();

      return () => {
        channel?.unsubscribe();
      };
    },
  );
}
