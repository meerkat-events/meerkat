import { useContext } from "react";
import useSWRMutation from "swr/mutation";
import { cooldownFor, UserContext } from "../context/user.tsx";
import { poster } from "./fetcher.ts";
import type { HTTPError } from "./http-error.ts";
import { useAuth } from "./use-auth.ts";

export function useVote(
  uid: string,
  { onError, onSuccess }: {
    onError?: (error: HTTPError) => void;
    onSuccess?: () => void;
  },
) {
  const { setCooldown } = useContext(UserContext);
  const { session } = useAuth();
  return useSWRMutation(
    `/api/v1/questions/${uid}/upvote`,
    (path: string, { arg }: { arg: Record<string, unknown> }) =>
      poster(path, { arg }, session?.access_token),
    {
      onSuccess: () => {
        onSuccess?.();
      },
      onError: (error) => {
        if (error.status === 429) {
          setCooldown(cooldownFor("vote", error));
        } else {
          onError?.(error);
        }
      },
    },
  );
}
