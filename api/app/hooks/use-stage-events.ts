import useSWR from "swr";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";
import type { Event } from "../types.ts";

export type UseStageEventsOptions = {
  stage?: string;
  date?: string;
};

export function useStageEvents(options?: UseStageEventsOptions) {
  let key: string | undefined = undefined;
  if (options?.stage) {
    const searchParams = new URLSearchParams();
    searchParams.set("limit", "100");
    searchParams.set("stage", options.stage);
    searchParams.set(
      "date",
      options.date ? options.date : "current",
    );
    key = `/api/v1/events?${searchParams.toString()}`;
  }
  return useSWR<
    { data: Event[] },
    HTTPError,
    {
      revalidateOnFocus: false;
    }
  >(
    key,
    fetcher,
  );
}
