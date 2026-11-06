import { usePost } from "./use-post.ts";

/** Switches an event's high engagement presenter view (organizers only). */
export function useSetHighEngagement(uid: string) {
  return usePost<{ data: { highEngagement: boolean } }, { enabled: boolean }>(
    `/api/v1/events/${uid}/high-engagement`,
  );
}
