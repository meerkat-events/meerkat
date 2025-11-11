import useSWRMutation from "swr/mutation";
import { poster } from "./fetcher.ts";
import { useAuth } from "./use-auth.ts";

export function useSelectQuestion(uid: string) {
  const { session } = useAuth();
  const { trigger } = useSWRMutation<{ data: { success: boolean } }>(
    `/api/v1/questions/${uid}/select`,
    (path: string, { arg }: { arg: Record<string, unknown> }) =>
      poster(path, { arg }, session?.access_token),
  );
  return { trigger };
}
