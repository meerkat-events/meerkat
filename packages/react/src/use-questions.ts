import { useCallback, useMemo } from "react";
import useSWR from "swr";
import { useMeerkatContext } from "./context.ts";
import { createFetcher } from "./fetcher.ts";
import { eventStreamEvents } from "./event-stream-events.ts";
import { useEventSource } from "./use-event-source.ts";
import { useJitteredRefresh } from "./use-jittered-refresh.ts";
import type {
  Question,
  UseQuestionsProps,
  UseQuestionsReturn,
} from "./types.ts";

const DATE_FIELDS: (keyof Question)[] = [
  "createdAt",
  "answeredAt",
  "selectedAt",
];

function parseDates(question: Record<string, unknown>): Question {
  const result = { ...question };
  for (const field of DATE_FIELDS) {
    const value = result[field];
    if (typeof value === "string") {
      result[field] = new Date(value);
    }
  }
  return result as unknown as Question;
}

function parseQuestions(
  questions: Record<string, unknown>[],
): Question[] {
  return questions.map(parseDates);
}

export function useQuestions({
  sessionId,
  sort = "newest",
  realtime = true,
  onReaction,
  onEventLive,
}: UseQuestionsProps): UseQuestionsReturn {
  const { apiUrl } = useMeerkatContext();
  const endpoint = `/api/v1/events/${sessionId}/questions?sort=${sort}`;

  // Parse the dates in the fetcher, before SWR caches the response: every
  // cache entry then holds `Date`s, and SWR's compare keeps the old array
  // when a refetch returns the same questions.
  const fetchQuestions = useMemo(() => {
    const fetchJson = createFetcher(apiUrl);
    return async (url: string): Promise<{ data: Question[] }> => {
      const raw = await fetchJson(url);
      return { data: parseQuestions(raw.data) };
    };
  }, [apiUrl]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    endpoint,
    fetchQuestions,
  );

  // Every viewer gets the same SSE update at once: refetch after a random
  // delay, one request at a time.
  const scheduleRefresh = useJitteredRefresh(() => mutate());

  const sseUrl = realtime && sessionId
    ? `${apiUrl}/api/v1/events/${sessionId}/questions/stream`
    : undefined;

  const { isConnected } = useEventSource({
    url: sseUrl,
    onMessage: scheduleRefresh,
    events: eventStreamEvents({ onReaction, onEventLive }),
  });

  const boundMutate = useCallback(async () => {
    const result = await mutate();
    return result?.data;
  }, [mutate]);

  return {
    data: data?.data,
    isLoading,
    isValidating,
    isConnected,
    mutate: boundMutate,
    error,
  };
}
