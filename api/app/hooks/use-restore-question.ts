import useSWRMutation from "swr/mutation";
import { poster } from "./fetcher.ts";
import { useAuth } from "./use-auth.ts";

/** Shows a hidden question again (organizers only). */
export function useRestoreQuestion(uid: string) {
  const { session } = useAuth();
  const { trigger } = useSWRMutation<{ data: { uid: string } }>(
    `/api/v1/questions/${uid}/restore`,
    (path: string, { arg }: { arg: Record<string, unknown> }) =>
      poster(path, { arg }, session?.access_token),
  );
  return { trigger };
}
