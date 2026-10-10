import { useRef } from "react";
import useSWR from "swr";
import useSWRSubscription from "swr/subscription";
import throttle from "lodash.throttle";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";
import { useAuth } from "./use-auth.ts";
import { useSupabase } from "../context/supabase.tsx";
import type { Question } from "../types.ts";

export type ConferenceQuestion = Question & {
  event: { id: number; uid: string; title: string; stage: string };
  deletedAt?: string | null;
  /** Set once automatic spam flagging ships; see question-state.ts. */
  flaggedAt?: string | null;
  flagReason?: string | null;
};

/**
 * Questions from every live session of a conference (organizers only).
 * Refetches whenever a question or vote changes anywhere (asked, selected,
 * answered, hidden, voted), and every 10 seconds for what Realtime doesn't
 * see, such as blocked users.
 */
export function useConferenceQuestions(conferenceId: number | undefined) {
  const { session } = useAuth();
  const token = session?.access_token;

  const { data, error, isLoading, mutate } = useSWR<
    { data: ConferenceQuestion[] },
    HTTPError
  >(
    conferenceId && token
      ? [
        `/api/v1/conferences/${conferenceId}/questions?live=true&hidden=true`,
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
  useSWRSubscription(
    supabase && conferenceId ? `conference-questions-${conferenceId}` : undefined,
    () => {
      const channel = supabase?.channel(`conference-questions-${conferenceId}`)
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
