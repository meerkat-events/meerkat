import useSWRMutation from "swr/mutation";
import { deleter } from "./fetcher.ts";

export function useDeleteQuestion(uid: string) {
  const { trigger } = useSWRMutation(
    `/api/v1/questions/${uid}`,
    deleter,
  );
  return { trigger };
}
