import useSWR from "swr";
import { useEventSource, useJitteredRefresh } from "@meerkat-events/react";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";
import { useAuth } from "./use-auth.ts";
import { useRefetchOnTokenRefresh } from "./use-refetch-on-token-refresh.ts";
import { apiUrl } from "../lib/api-url.ts";
import type { ModeratedQuestion } from "../components/Manage/question-state.ts";
import type { TimeWindow } from "./use-conference-stats.ts";

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
  scope:
    | { live: true }
    | { event: string }
    // What automatic moderation hid or marked for review, of every session,
    // asked in the window if there is one.
    | { moderated: true; window?: TimeWindow | undefined },
) {
  const { session } = useAuth();
  const token = session?.access_token;
  const userId = session?.user.id;
  const filter = "live" in scope
    ? "live=true"
    : "event" in scope
    ? `event=${encodeURIComponent(scope.event)}`
    : new URLSearchParams({
      moderated: "true",
      ...(scope.window
        ? { from: scope.window.from.toISOString(), to: scope.window.to.toISOString() }
        : {}),
    }).toString();

  // Keyed on the user, not the token, which changes on every refresh and
  // would blank the page until the refetch.
  const { data, error, isLoading, mutate } = useSWR<
    { data: ConferenceQuestion[] },
    HTTPError
  >(
    conferenceId && token && userId
      ? [
        `/api/v1/conferences/${conferenceId}/questions?${filter}&hidden=true`,
        userId,
      ]
      : undefined,
    ([path]: [string, string]) => fetcher(path, token),
    { refreshInterval: 10_000 },
  );
  useRefetchOnTokenRefresh(token, mutate);

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
