import { useSupabase } from "~/context/supabase";
import useSWRSubscription from "swr/subscription";
import type { Event } from "~/types";

const PREFIX = "conference-";

export type UseLiveEventSubscriptionProps = {
  onUpdate: () => void;
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
            event: "live",
          },
          (_payload) => {
            onUpdate();
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
