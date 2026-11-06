import { usePost } from "./use-post.ts";

export function useMarkAsAnswered(uid: string) {
  return usePost<{ data: { success: boolean } }>(
    `/api/v1/questions/${uid}/mark-as-answered`,
  );
}
