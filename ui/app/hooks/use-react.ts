import { useContext } from "react";
import useSWRMutation from "swr/mutation";
import { UserContext } from "../context/user.tsx";
import { poster } from "./fetcher.ts";
import { posthog } from "posthog-js";
import type { HTTPError } from "./http-error.ts";

export type UseReactReturnType = {
  trigger: (obj: { uid: string }) => void;
};

export function useReact(
  uid: string,
  { onError }: { onError?: (error: HTTPError) => void },
): UseReactReturnType {
  const { setIsOnCooldown } = useContext(UserContext);
  const { trigger } = useSWRMutation(`/api/v1/events/${uid}/react`, poster, {
    onSuccess: () => {
      posthog.capture("reaction_created", {
        event_uid: uid,
      });
    },
    onError: (error) => {
      if (error.status === 429) {
        setIsOnCooldown(true);
      } else {
        onError?.(error);
      }
    },
  });

  return {
    trigger,
  };
}
