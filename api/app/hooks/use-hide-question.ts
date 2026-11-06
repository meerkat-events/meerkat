import { usePost } from "./use-post.ts";

/**
 * Hides a question (moderators): only its author still sees it, and an
 * organizer can restore it.
 */
export function useHideQuestion(uid: string) {
  return usePost<{ data: { uid: string } }>(`/api/v1/questions/${uid}/hide`);
}
