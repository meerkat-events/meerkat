import useSWR from "swr";
import { HTTPError } from "./http-error.ts";
import { deleter, fetcher, poster } from "./fetcher.ts";
import { useAuth } from "./use-auth.ts";
import { useRefetchOnTokenRefresh } from "./use-refetch-on-token-refresh.ts";

export type GrantableRole = "organizer" | "moderator" | "attendee";

export type ConferenceMember = {
  userId: string;
  email: string | null;
  role: GrantableRole;
};

export type ConferenceInvitation = {
  id: number;
  email: string;
  role: GrantableRole;
};

export type ConferencePermissions = {
  /** Organizers and moderators; attendees come from `useConferenceAttendees`. */
  members: ConferenceMember[];
  /** Every pending invitation, attendees' included. */
  invitations: ConferenceInvitation[];
  attendeeCount: number;
};

/**
 * Who has access to a conference besides its attendees, and the changes to
 * it (organizers only).
 */
export function useConferencePermissions(conferenceId: number | undefined) {
  const { session } = useAuth();
  const token = session?.access_token;
  const viewerId = session?.user.id;
  const path = `/api/v1/conferences/${conferenceId}/permissions`;

  // Keyed on the user, not the token, which changes on every refresh and
  // would blank the page until the refetch.
  const { data, error, isLoading, mutate } = useSWR<
    { data: ConferencePermissions },
    HTTPError
  >(
    conferenceId && token && viewerId ? [path, viewerId] : undefined,
    ([path]: [string, string]) => fetcher(path, token),
  );
  useRefetchOnTokenRefresh(token, mutate);

  /** Adds an email or changes its role; invited means it has no account yet. */
  const setRole = async (email: string, role: GrantableRole) => {
    const { data } = await poster(path, { arg: { email, role } }, token) as {
      data: { status: "member" | "invited" };
    };
    await mutate();
    return data.status;
  };

  const removeMember = async (userId: string) => {
    await deleter(`${path}/members/${userId}`, token);
    await mutate();
  };

  const removeInvitation = async (id: number) => {
    await deleter(`${path}/invitations/${id}`, token);
    await mutate();
  };

  return {
    data: data?.data,
    error,
    isLoading,
    setRole,
    removeMember,
    removeInvitation,
  };
}
