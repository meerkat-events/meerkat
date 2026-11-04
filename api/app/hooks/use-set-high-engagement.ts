import useSWRMutation from "swr/mutation";
import { poster } from "./fetcher.ts";
import { useAuth } from "./use-auth.ts";

/** Switches an event's high engagement presenter view (organizers only). */
export function useSetHighEngagement(uid: string) {
  const { session } = useAuth();
  const { trigger, isMutating } = useSWRMutation<
    { data: { highEngagement: boolean } },
    Error,
    string,
    { enabled: boolean }
  >(
    `/api/v1/events/${uid}/high-engagement`,
    (path: string, { arg }: { arg: { enabled: boolean } }) =>
      poster(path, { arg }, session?.access_token),
  );
  return { trigger, isMutating };
}
