import useSWRSubscription from "swr/subscription";
import { useSupabase } from "../context/supabase.tsx";
import type { Event, Reaction } from "../types.ts";

const REACTIONS_PREFIX = "reactions-";

export const useReactionsSubscription = (event: Event | undefined, {
  onUpdate,
}: {
  onUpdate: (reaction: Reaction) => void;
}) => {
  const { client: supabase } = useSupabase();
  const { error } = useSWRSubscription(
    typeof event?.id === "number" && supabase
      ? `${REACTIONS_PREFIX}${event.id}`
      : undefined,
    (key) => {
      const eventId = key.substring(REACTIONS_PREFIX.length);
      const channel = supabase?.channel("reactions-inserts")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "reactions",
            filter: `event_id=eq.${eventId}`,
          },
          (payload) => {
            onUpdate(payload.new as Reaction);
          },
        )
        .subscribe();

      return () => {
        channel?.unsubscribe();
      };
    },
  );

  return {
    error,
  };
};
