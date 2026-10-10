import { useRef } from "react";
import useSWR from "swr";
import useSWRSubscription from "swr/subscription";
import throttle from "lodash.throttle";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";
import { useAuth } from "./use-auth.ts";
import { useSupabase } from "../context/supabase.tsx";
import type { ModeratedQuestion } from "../components/Manage/question-state.ts";

export type ConferenceQuestion = ModeratedQuestion & {
  event: { id: number; uid: string; title: string; stage: string };
};

/**
 * Questions from every live session of a conference, or from one session
 * (organizers only), including what organizers or moderation hid. Refetches
 * whenever a question or vote changes anywhere (asked, selected, answered,
 * hidden, voted), and every 10 seconds for what Realtime doesn't see, such as
 * blocked users and questions moderation hid on arrival.
 */
export function useConferenceQuestions(
  conferenceId: number | undefined,
  scope: { live: true } | { event: string },
) {
  const { session } = useAuth();
  const token = session?.access_token;
  const filter = "live" in scope
    ? "live=true"
    : `event=${encodeURIComponent(scope.event)}`;

  const { data, error, isLoading, mutate } = useSWR<
    { data: ConferenceQuestion[] },
    HTTPError
  >(
    conferenceId && token
      ? [
        `/api/v1/conferences/${conferenceId}/questions?${filter}&hidden=true`,
        token,
      ]
      : undefined,
    ([path, token]: [string, string]) => fetcher(path, token),
    { refreshInterval: 10_000 },
  );

  const mutateRef = useRef(mutate);
  mutateRef.current = mutate;
  const refresh = useRef(throttle(() => mutateRef.current(), 500)).current;

  const { client: supabase } = useSupabase();
  // One channel per list, so a feed and a session panel each refresh.
  const channelName = `conference-questions-${conferenceId}-${filter}`;
  useSWRSubscription(
    supabase && conferenceId ? channelName : undefined,
    () => {
      const channel = supabase?.channel(channelName)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "questions" },
          () => refresh(),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "votes" },
          () => refresh(),
        )
        .subscribe();

      return () => {
        channel?.unsubscribe();
      };
    },
  );

  return { data: data?.data, error, isLoading, mutate };
}
