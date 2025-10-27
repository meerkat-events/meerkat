import useSWR from "swr";
import { fetcher } from "./fetcher.ts";
import { HTTPError } from "./http-error.ts";
import type { EventPod } from "../types.ts";

export function usePods() {
  const { data, ...rest } = useSWR<{ data: EventPod[] }, HTTPError>(
    `/api/v1/speaker/pods`,
    fetcher,
    {
      fallbackData: { data: [] },
    },
  );

  data?.data.forEach((pod) => {
    const createdAt = new Date(pod.pod.entries.created_at.value as string);
    pod.pod.entries.created_at.value = createdAt;
  });

  return {
    data: data?.data,
    ...rest,
  };
}
