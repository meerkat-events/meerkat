import { usePost } from "./use-post.ts";

export function useGoLive(uid: string) {
  return usePost<{ data: { success: boolean } }>(`/api/v1/events/${uid}/live`);
}
