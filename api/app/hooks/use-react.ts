import { useContext } from "react";
import useSWRMutation from "swr/mutation";
import { UserContext } from "../context/user.tsx";
import { poster } from "./fetcher.ts";
import type { HTTPError } from "./http-error.ts";
import { useAuth } from "./use-auth.ts";

export type UseReactReturnType = {
  trigger: (obj: { uid: string }) => void;
};

export function useReact(
  uid: string,
  { onError }: { onError?: (error: HTTPError) => void },
): UseReactReturnType {
  const { setIsOnCooldown } = useContext(UserContext);
  const { session } = useAuth();
  const { trigger } = useSWRMutation(
    `/api/v1/events/${uid}/react`,
    (path: string, { arg }: { arg: Record<string, unknown> }) =>
      poster(path, { arg }, session?.access_token),
    {
      onError: (error) => {
        if (error.status === 429) {
          setIsOnCooldown(true);
        } else {
          onError?.(error);
        }
      },
    },
  );

  return {
    trigger,
  };
}
