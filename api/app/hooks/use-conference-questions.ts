import { useEffect, useRef } from "react";
import useSWR from "swr";
import throttle from "lodash.throttle";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";
import { useAuth } from "./use-auth.ts";
import { apiUrl } from "../lib/api-url.ts";
import { readEventStream } from "../lib/fetch-event-stream.ts";
import type { ModeratedQuestion } from "../components/Manage/question-state.ts";

export type ConferenceQuestion = ModeratedQuestion & {
  event: { id: number; uid: string; title: string; stage: string };
};

/**
 * Questions from every live session of a conference, or from one session
 * (organizers only), including what organizers or moderation hid. Refetches
 * whenever the conference's question stream says a question or vote changed
 * (asked, also when moderation hid it, selected, answered, deleted, restored,
 * voted), and every 10 seconds for what sends no message, such as blocked
 * users.
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

  // The stream reads the latest token on every reconnect, so a token refresh
  // doesn't restart it.
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const hasToken = token !== undefined;

  // One stream per list, so a feed and a session panel each refresh.
  useEffect(() => {
    if (!conferenceId || !hasToken) {
      return;
    }
    const controller = new AbortController();
    void readEventStream({
      url: apiUrl(`/api/v1/conferences/${conferenceId}/questions/stream`),
      getToken: () => tokenRef.current,
      onMessage: (message) => {
        if (message.data !== "ping") {
          refresh();
        }
      },
      // Messages sent while the stream was down are lost.
      onReconnect: refresh,
      signal: controller.signal,
    });
    return () => controller.abort();
  }, [conferenceId, hasToken, refresh]);

  return { data: data?.data, error, isLoading, mutate };
}
