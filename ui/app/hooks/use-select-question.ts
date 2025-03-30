import useSWRMutation from "swr/mutation";
import { poster } from "./fetcher.ts";

export function useSelectQuestion(uid: string) {
  const { trigger } = useSWRMutation<{ data: { success: boolean } }>(
    `/api/v1/questions/${uid}/select`,
    poster,
  );
  return { trigger };
}
