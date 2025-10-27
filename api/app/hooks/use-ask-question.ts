import useSWRMutation from "swr/mutation";
import { poster } from "./fetcher.ts";
import type { Event, Question } from "../types.ts";
import { useContext } from "react";
import { UserContext } from "../context/user.tsx";
import { HTTPError } from "./http-error.ts";
import { posthog } from "posthog-js";

export const useAskQuestion = (event: Event | undefined, {
  onSuccess,
  onError,
}: { onSuccess: () => void; onError: (error: HTTPError) => void }) => {
  const { setIsOnCooldown } = useContext(UserContext);
  const { trigger } = useSWRMutation<
    { data: Question[] },
    HTTPError,
    string | undefined,
    { question: string }
  >(
    event ? `/api/v1/events/${event.uid}/questions` : undefined,
    poster,
    {
      onSuccess: () => {
        onSuccess();
        posthog.capture("question_asked", {
          event_uid: event?.uid,
        });
      },
      onError: (error) => {
        if (error.status === 429) {
          setIsOnCooldown(true);
        } else {
          onError(error);
        }
      },
    },
  );

  return {
    trigger,
  };
};
