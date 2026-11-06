import { usePost } from "./use-post.ts";

export function useBlockUser(uid: string) {
  return usePost<{ data: Record<string, never> }>(`/api/v1/users/${uid}/block`);
}
