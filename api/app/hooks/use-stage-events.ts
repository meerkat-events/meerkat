import useSWR from "swr";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";
import type { Event } from "../types.ts";

export function useStageEvents(stage: string | undefined) {
  let key: string | undefined = undefined;
  if (stage) {
    const searchParams = new URLSearchParams();
    searchParams.set("limit", "100");
    searchParams.set("stage", stage);
    searchParams.set("date", new Date().toISOString().slice(0, 10));
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
