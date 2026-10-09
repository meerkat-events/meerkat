import { useCallback } from "react";
import useSWR from "swr";
import { useEventSource } from "@meerkat-events/react";
import { apiUrl } from "../lib/api-url.ts";
import type { Question } from "../types.ts";
import { fetcher } from "./fetcher.ts";
import type { HTTPError } from "./http-error.ts";
import { useAuth } from "./use-auth.ts";

/**
 * Questions of an event for the Q&A page, kept live over SSE. Unlike
 * `useQuestions` from the react package, it sends the session token, so the
 * list also contains the user's own questions that automatic moderation hid
 * from everyone else. Embedding sites never ask questions and keep using the
 * package.
 */
export const useEventQuestions = (
  uid: string | undefined,
  sort: "newest" | "popular",
) => {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const endpoint = uid ? `/api/v1/events/${uid}/questions?sort=${sort}` : null;

  // The token is part of the key, so the list refetches when a session starts
  // or its token refreshes.
  const { data, error, isLoading, mutate } = useSWR<
    { data: Question[] },
    HTTPError,
    [string, string | undefined] | null
  >(
    endpoint ? [endpoint, accessToken] : null,
    ([path, token]) => fetcher(path, token),
  );

  const refresh = useCallback(() => {
    mutate();
  }, [mutate]);

  useEventSource({
    url: uid ? apiUrl(`/api/v1/events/${uid}/questions/stream`) : undefined,
    onMessage: refresh,
  });

  return { data: data?.data, error, isLoading, mutate: refresh };
};
