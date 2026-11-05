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

export type ModeratingRole = "organizer" | "moderator";

/** Organizers and moderators moderate the Q&A; only organizers see /manage. */
export const canModerate = (
  role: ConferenceRole,
): role is ConferenceRole & { role: ModeratingRole } =>
  role.role === "organizer" || role.role === "moderator";

/** Where someone lands after signing in, by their roles. */
export function homeFor(roles: ConferenceRole[]) {
  if (roles.some((r) => r.role === "organizer")) return "/manage";
  return "/account";
}

export function useConferenceRoles() {
  const { session } = useAuth();
  const token = session?.access_token;
  // Keyed on the token too, so signing in as someone else never shows the
  // previous user's roles from the cache.
  const { data, error, isLoading, mutate } = useSWR<
    { data: ConferenceRole[] },
    HTTPError
  >(
    token ? [`/api/v1/users/me/roles`, token] : undefined,
    ([path, token]: [string, string]) => fetcher(path, token),
  );

  return { data: data?.data, error, isLoading, mutate };
}
