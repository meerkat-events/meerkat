import { usePost } from "./use-post.ts";

export function useSelectQuestion(uid: string) {
  return usePost<{ data: { success: boolean } }>(
    `/api/v1/questions/${uid}/select`,
  );
}
