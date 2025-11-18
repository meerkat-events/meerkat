import { useContext } from "react";
import useSWRMutation from "swr/mutation";
import { UserContext } from "../context/user.tsx";
import { poster } from "./fetcher.ts";
import { posthog } from "posthog-js";
import type { HTTPError } from "./http-error.ts";
import { useAuth } from "./use-auth.ts";

export function useVote(
  uid: string,
  { onError, onSuccess }: {
    onError?: (error: HTTPError) => void;
    onSuccess?: () => void;
  },
) {
  const { setIsOnCooldown } = useContext(UserContext);
  const { session } = useAuth();
  return useSWRMutation(
    `/api/v1/questions/${uid}/upvote`,
    (path: string, { arg }: { arg: Record<string, unknown> }) =>
      poster(path, { arg }, session?.access_token),
    {
      onSuccess: () => {
        posthog.capture("vote_toggled", {
          question_uid: uid,
        });
        onSuccess?.();
      },
      onError: (error) => {
        if (error.status === 429) {
          setIsOnCooldown(true);
        } else {
          onError?.(error);
        }
      },
    },
  );
}
