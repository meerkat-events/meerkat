import { useCallback, useMemo } from "react";
import useSWR from "swr";
import { useMeerkatContext } from "./context.ts";
import { parseQuestions } from "./fetcher.ts";
import { useEventSource } from "./use-event-source.ts";
import type {
  Question,
  UseQuestionsProps,
  UseQuestionsReturn,
} from "./types.ts";

export function useQuestions({
  sessionId,
  sort = "newest",
  realtime = true,
}: UseQuestionsProps): UseQuestionsReturn {
  const { apiUrl } = useMeerkatContext();
  const endpoint = `/api/v1/events/${sessionId}/questions?sort=${sort}`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<{
    data: Question[];
  }>(endpoint, {
    onSuccess(raw) {
      if (raw?.data) {
        raw.data = parseQuestions(
          raw.data as unknown as Record<string, unknown>[],
        );
      }
    },
  });

  const stableMutate = useCallback(() => {
    mutate();
  }, [mutate]);

  const sseUrl = useMemo(
    () =>
      realtime && sessionId
        ? `${apiUrl}/api/v1/events/${sessionId}/questions/stream`
        : undefined,
    [apiUrl, sessionId, realtime],
  );

  const { isConnected } = useEventSource({
    url: sseUrl,
    onMessage: stableMutate,
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
