import useSWRSubscription from "swr/subscription";
import { useSupabase } from "../context/supabase.tsx";
import type { Event } from "../types.ts";

const PREFIX = "questions-";

export const useQuestionsSubscription = (
  event: Event | undefined,
  {
    onUpdate,
  }: {
    onUpdate: () => void;
  },
) => {
  const { client: supabase } = useSupabase();
  const { error } = useSWRSubscription(
    typeof event?.id === "number" && supabase
      ? `${PREFIX}${event.id}`
      : undefined,
    (key) => {
      const eventId = key.substring(PREFIX.length);
      const channel = supabase?.channel("questions-updates")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "questions",
            filter: `event_id=eq.${eventId}`,
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

  const questionIds = event?.questions.map((question) => question.id).sort();

  const { error: error2 } = useSWRSubscription(
    typeof questionIds === "object" && supabase
      ? questionIds.join(", ")
      : undefined,
    (key) => {
      const channel = supabase?.channel("votes-changes")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "votes",
            filter: `question_id=in.(${key})`,
          },
          (_payload) => {
            onUpdate();
          },
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "votes",
            filter: `question_id=in.(${key})`,
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
    error: error || error2,
  };
};
