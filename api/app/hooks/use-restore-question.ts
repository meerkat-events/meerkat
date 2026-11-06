import { usePost } from "./use-post.ts";

/** Shows a hidden question again (organizers only). */
export function useRestoreQuestion(uid: string) {
  return usePost<{ data: { uid: string } }>(`/api/v1/questions/${uid}/restore`);
}
