import { useSupabase } from "~/context/supabase";
import useSWRSubscription from "swr/subscription";
import type { Event } from "~/types";

const PREFIX = "event-";

export type UseEventSubscriptionProps = {
  onUpdate: () => void;
};

export function useEventSubscription(
  event: Event | undefined,
  { onUpdate }: UseEventSubscriptionProps,
) {
  const { client: supabase } = useSupabase();

  const { error: error3 } = useSWRSubscription(
    typeof event?.id === "number" && supabase
      ? `${PREFIX}${event.id}`
      : undefined,
    (key) => {
      const eventId = key.substring(PREFIX.length);
      const channel = supabase?.channel("event-updates")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "events",
            filter: `id=eq.${eventId}`,
          },
          (payload) => {
            console.log("payload", payload);
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
