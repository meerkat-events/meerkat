import useSWRMutation from "swr/mutation";
import { poster } from "./fetcher.ts";
import { useAuth } from "./use-auth.ts";

/**
 * Hides a question (moderators): only its author still sees it, and an
 * organizer can restore it.
 */
export function useHideQuestion(uid: string) {
  const { session } = useAuth();
  const { trigger } = useSWRMutation<{ data: { uid: string } }>(
    `/api/v1/questions/${uid}/hide`,
    (path: string, { arg }: { arg: Record<string, unknown> }) =>
      poster(path, { arg }, session?.access_token),
  );
  return { trigger };
}
