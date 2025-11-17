import { useCallback } from "react";
import useSWR, { type SWRConfiguration } from "swr";
import useSWRSubscription from "swr/subscription";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";
import { useSupabase } from "../context/supabase.tsx";
import throttle from "lodash.throttle";

type QuestionWithEvent = {
  id: number;
  uid: string;
  eventId: number;
  question: string;
  createdAt: Date;
  selectedAt?: Date | null;
  answeredAt?: Date | null;
  deletedAt?: Date | null;
  votes: number;
  user?: {
    id: string;
    name?: string;
  };
  event: {
    id: number;
    uid: string;
    title: string;
  };
};

type Options = {
  swr?: SWRConfiguration;
};

export const useAllQuestions = (options?: Options) => {
  const { data, error, isLoading, mutate, isValidating } = useSWR<
    { data: QuestionWithEvent[] },
    HTTPError
  >(
    "/api/v1/questions",
    fetcher,
    { fallbackData: { data: [] }, ...options?.swr },
  );

  const refresh = useCallback(
    throttle(() => {
      mutate();
    }, 500),
    [mutate],
  );

  const { client: supabase } = useSupabase();
  useSWRSubscription(
    supabase ? "all-questions" : undefined,
    () => {
      const channel = supabase?.channel("all-questions-updates")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "questions",
          },
          (_payload) => {
            refresh();
          },
        )
        .subscribe();

      return () => {
        channel?.unsubscribe();
      };
    },
  );

  return { data: data?.data, error, isLoading, isValidating, mutate };
};
