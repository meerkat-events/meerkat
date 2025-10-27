import useSWR, { type SWRConfiguration } from "swr";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";
import type { Question } from "../types.ts";

type Options = {
  sort?: Sort;
  answered?: boolean;
  swr?: SWRConfiguration;
};

export type Sort = "newest" | "popular";

export const useQuestions = (uid: string | undefined, options?: Options) => {
  const searchParams = new URLSearchParams();
  if (options?.sort) {
    searchParams.set("sort", options.sort);
  }
  if (typeof options?.answered === "boolean") {
    searchParams.set("answered", options.answered.toString());
  }
  const { data, error, isLoading, mutate } = useSWR<
    { data: Question[] },
    HTTPError
  >(
    uid
      ? `/api/v1/events/${uid}/questions?${searchParams.toString()}`
      : undefined,
    fetcher,
    { fallbackData: { data: [] }, ...options?.swr },
  );

  return { data: data?.data, error, isLoading, mutate };
};
