import useSWRMutation from "swr/mutation";
import { poster } from "./fetcher.ts";

export function useGoLive(uid: string) {
  const { trigger } = useSWRMutation<{ data: { success: boolean } }>(
    `/api/v1/events/${uid}/live`,
    poster,
  );
  return { trigger };
}
