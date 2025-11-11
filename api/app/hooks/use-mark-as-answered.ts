import useSWRMutation from "swr/mutation";
import { poster } from "./fetcher.ts";
import { useAuth } from "./use-auth.ts";

export function useMarkAsAnswered(uid: string) {
  const { session } = useAuth();
  const { trigger } = useSWRMutation<{ data: { success: boolean } }>(
    `/api/v1/questions/${uid}/mark-as-answered`,
    (path: string, { arg }: { arg: Record<string, unknown> }) =>
      poster(path, { arg }, session?.access_token),
  );
  return { trigger };
}
