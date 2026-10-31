import useSWR from "swr";
import { useEventSource, useJitteredRefresh } from "@meerkat-events/react";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";
import { useAuth } from "./use-auth.ts";
import { apiUrl } from "../lib/api-url.ts";
import type { ModeratedQuestion } from "../components/Manage/question-state.ts";

export type ConferenceQuestion = ModeratedQuestion & {
  event: { id: number; uid: string; title: string; stage: string };
};

/**
 * Questions from every live session of a conference, or from one session
 * (organizers only), including what organizers or moderation hid. Refetches
 * whenever the conference's question stream says a question or vote changed
 * (asked, selected, answered, deleted, restored, voted, a user blocked), and
 * every 10 seconds for what sends no message: questions moderation hid on
 * arrival, which no public stream may reveal.
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

  // One stream per list, so a feed and a session panel each refresh.
  const scheduleRefresh = useJitteredRefresh(() => mutate());
  useEventSource({
    url: conferenceId
      ? apiUrl(`/api/v1/conferences/${conferenceId}/questions/stream`)
      : undefined,
    onMessage: scheduleRefresh,
  });

  return { data: data?.data, error, isLoading, mutate };
}
