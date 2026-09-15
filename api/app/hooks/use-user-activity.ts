import useSWR from "swr";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";
import { useAuth } from "./use-auth.ts";

type RawSession = {
  uid: string;
  title: string;
  stage: string;
  start: string;
  questions: number;
  votes: number;
  reactions: number;
};

type RawQuestion = {
  id: number;
  eventId: number;
  uid: string;
  question: string;
  createdAt: string;
  selectedAt: string | null;
  answeredAt: string | null;
  deletedAt: string | null;
  votes: number;
  event: { uid: string; title: string; stage: string; start: string };
};

type RawVotedQuestion = RawQuestion & {
  user: { id: string; name: string };
};

export type UserActivity = {
  user: { id: string; name: string; blocked: boolean };
  summary: {
    questions: number;
    hidden: number;
    votes: number;
    reactions: number;
    sessions: number;
  };
  sessions: RawSession[];
  questions: RawQuestion[];
  upvoted: RawVotedQuestion[];
};

/** One person's history in this conference (organizers only). */
export function useUserActivity(
  conferenceId: number | undefined,
  userId: string | undefined,
) {
  const { session } = useAuth();
  const token = session?.access_token;

  const { data, error, isLoading, mutate } = useSWR<
    { data: UserActivity },
    HTTPError
  >(
    conferenceId && userId && token
      ? [`/api/v1/conferences/${conferenceId}/users/${userId}/activity`, token]
      : undefined,
    ([path, token]: [string, string]) => fetcher(path, token),
  );

  return { data: data?.data, error, isLoading, mutate };
}
