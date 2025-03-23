import useSWR from "swr";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";
import { useUser } from "./use-user.ts";

export type UserStats = {
  votes: number;
  questions: number;
  answeredQuestions: number;
  reactions: number;
  receivedVotes: number;
};

export function useUserStats() {
  const { isAuthenticated } = useUser();

  const { data, error, isLoading, mutate } = useSWR<
    { data: UserStats },
    HTTPError
  >(
    isAuthenticated ? "/api/v1/users/me/stats" : undefined,
    fetcher,
    {
      fallbackData: {
        data: {
          votes: 0,
          questions: 0,
          answeredQuestions: 0,
          reactions: 0,
          receivedVotes: 0,
        },
      },
    },
  );

  return { data: data?.data, error, isLoading, mutate };
}
