import { useSupabase } from "../context/supabase.tsx";
import useSWRSubscription from "swr/subscription";
import type { Event } from "../types.ts";
import {
  LIVE_EVENT,
  type LiveEventMessage,
  parseLiveEventMessage,
} from "../../live-event.ts";

const PREFIX = "conference-";

export type UseLiveEventSubscriptionProps = {
  onUpdate: (liveEvent: LiveEventMessage) => void;
};

export function useLiveEventSubscription(
  event: Event | undefined,
  { onUpdate }: UseLiveEventSubscriptionProps,
) {
  const { client: supabase } = useSupabase();

  const { error: error3 } = useSWRSubscription(
    typeof event?.id === "number" && supabase
      ? `${PREFIX}${event.conferenceId}`
      : undefined,
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
            onUpdate(liveEvent);
          },
        )
        .subscribe();

      return () => {
        channel?.unsubscribe();
      };
    },
  );

  return {
    error: error3,
  };
}
