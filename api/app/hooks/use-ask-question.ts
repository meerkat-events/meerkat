import useSWRMutation from "swr/mutation";
import { poster } from "./fetcher.ts";
import type { Event, Question } from "../types.ts";
import { useContext } from "react";
import { cooldownFor, UserContext } from "../context/user.tsx";
import { HTTPError } from "./http-error.ts";
import { useAuth } from "./use-auth.ts";

export const useAskQuestion = (event: Event | undefined, {
  onSuccess,
  onError,
}: { onSuccess: () => void; onError: (error: HTTPError) => void }) => {
  const { setCooldown } = useContext(UserContext);
  const { session } = useAuth();
  return useSWRMutation<
    { data: Question[] },
    HTTPError,
    string | undefined,
    { question: string }
  >(
    event ? `/api/v1/events/${event.uid}/questions` : undefined,
    (path, { arg }) => poster(path, { arg }, session?.access_token),
    {
      onSuccess: () => {
        onSuccess();
      },
      onError: (error) => {
        if (error.status === 429) {
          setCooldown(cooldownFor("question", error));
        } else {
          onError(error);
        }
      },
    },
  );
};
