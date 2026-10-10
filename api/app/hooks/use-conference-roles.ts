import useSWR from "swr";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";
import { useAuth } from "./use-auth.ts";

export type ConferenceRole = {
  conferenceId: number;
  conferenceName: string | null;
  role: "attendee" | "organizer" | "moderator";
  grantedAt: Date;
};

/** Organizers and moderators moderate the Q&A; only organizers see /manage. */
export const canModerate = (role: ConferenceRole) =>
  role.role === "organizer" || role.role === "moderator";

/** Where someone lands after signing in, by their roles. */
export function homeFor(roles: ConferenceRole[]) {
  if (roles.some((r) => r.role === "organizer")) return "/manage";
  return "/account";
}

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
