import useSWR from "swr";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";
import { useAuth } from "./use-auth.ts";

export type ConferenceRole = {
  conferenceId: number;
  conferenceName: string | null;
  role: "attendee" | "speaker" | "organizer";
  grantedAt: Date;
};

export function useConferenceRoles() {
  const { isAuthenticated, session } = useAuth();
  const { data, error, isLoading, mutate } = useSWR<
    { data: ConferenceRole[] },
    HTTPError,
    {
      revalidateOnFocus: false;
    }
  >(
    isAuthenticated ? `/api/v1/users/me/roles` : undefined,
    (path) => fetcher(path, session?.access_token),
  );

  return { data: data?.data, error, isLoading, mutate };
}
