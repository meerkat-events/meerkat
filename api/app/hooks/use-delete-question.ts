import useSWRMutation from "swr/mutation";
import { deleter } from "./fetcher.ts";
import { useAuth } from "./use-auth.ts";

export function useDeleteQuestion(uid: string) {
  const { session } = useAuth();
  const { trigger } = useSWRMutation(
    `/api/v1/questions/${uid}`,
    (path) => deleter(path, session?.access_token),
  );
  return { trigger };
}
