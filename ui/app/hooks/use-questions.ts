import useSWR from "swr";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";
import type { Question } from "../types.ts";

export type Sort = "newest" | "popular";

export const useQuestions = (uid: string | undefined, sort?: Sort) => {
  const { data, error, isLoading, mutate } = useSWR<
    { data: Question[] },
    HTTPError
  >(
    uid
      ? `/api/v1/events/${uid}/questions${sort ? `?sort=${sort}` : ""}`
      : undefined,
    fetcher,
    { fallbackData: { data: [] } },
  );

  return { data: data?.data, error, isLoading, mutate };
};
