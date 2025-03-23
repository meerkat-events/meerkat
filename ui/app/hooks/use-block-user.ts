import useSWRMutation from "swr/mutation";
import { poster } from "./fetcher.ts";

export function useBlockUser(uid: string) {
  const { trigger } = useSWRMutation<{ data: { success: boolean } }>(
    `/api/v1/users/${uid}/block`,
    poster,
  );
  return { trigger };
}
