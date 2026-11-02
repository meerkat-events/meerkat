import { useCallback } from "react";
import useSWR from "swr";
import {
  type EventStreamCallbacks,
  eventStreamEvents,
  useEventSource,
  useJitteredRefresh,
} from "@meerkat-events/react";
import { apiUrl } from "../lib/api-url.ts";
import type { Question } from "../types.ts";
import { fetcher } from "./fetcher.ts";
import type { HTTPError } from "./http-error.ts";
import { useAuth } from "./use-auth.ts";
import { useSupabase } from "../context/supabase.tsx";

/**
 * Questions of an event for the Q&A page, kept live over the event's SSE
 * stream, which also delivers reactions to `onReaction` and, through
 * `onEventLive`, every session put live on this event's stage (this one
 * included). Unlike `useQuestions` from the react package, it sends the
 * session token, so the list also contains the user's own questions that
 * automatic moderation hid from everyone else. Embedding sites never ask
 * questions and keep using the package.
 */
export const useEventQuestions = (
  uid: string | undefined,
  sort: "newest" | "popular",
  { onReaction, onEventLive }: EventStreamCallbacks = {},
) => {
  const { session, isLoading: isAuthLoading } = useAuth();
  const { client } = useSupabase();
  const accessToken = session?.access_token;
  const endpoint = uid ? `/api/v1/events/${uid}/questions?sort=${sort}` : null;

  // Wait until the browser knows whether there is a session (a stored one, or
  // the one a Devcon handover brings in the URL fragment), so the first fetch
  // already carries the token instead of fetching the list twice. Without a
  // Supabase client (the server render, or no Supabase configured) there is
  // no session to wait for. The token is part of the key, so the list
  // refetches when a session starts or ends or its token refreshes.
  const isWaitingForSession = client !== undefined && isAuthLoading;
  const { data, error, isLoading, mutate } = useSWR<
    { data: Question[] },
    HTTPError,
    [string, string | undefined] | null
  >(
    endpoint && !isWaitingForSession ? [endpoint, accessToken] : null,
    ([path, token]) => fetcher(path, token),
  );

  // For the page's own changes (posting, voting): refetch right away.
  const refresh = useCallback(() => {
    mutate();
  }, [mutate]);

  // Every viewer gets the same SSE update at once: refetch after a random
  // delay, one request at a time.
  const scheduleRefresh = useJitteredRefresh(() => mutate());

  useEventSource({
    url: uid ? apiUrl(`/api/v1/events/${uid}/questions/stream`) : undefined,
    onMessage: scheduleRefresh,
    events: eventStreamEvents({ onReaction, onEventLive }),
  });

  // Loading while the session is still unknown too, so the page doesn't show
  // "No questions, yet" before the first list arrives.
  return {
    data: data?.data,
    error,
    isLoading: isWaitingForSession || isLoading,
    mutate: refresh,
  };
};
