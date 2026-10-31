import useSWR from "swr";
import { HTTPError } from "./http-error.ts";
import { deleter, fetcher, poster } from "./fetcher.ts";
import { useAuth } from "./use-auth.ts";

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
  members: ConferenceMember[];
  invitations: ConferenceInvitation[];
};

/** Who has access to a conference, and the changes to it (organizers only). */
export function useConferencePermissions(conferenceId: number | undefined) {
  const { session } = useAuth();
  const token = session?.access_token;
  const path = `/api/v1/conferences/${conferenceId}/permissions`;

  const { data, error, isLoading, mutate } = useSWR<
    { data: ConferencePermissions },
    HTTPError
  >(
    conferenceId && token ? [path, token] : undefined,
    ([path, token]: [string, string]) => fetcher(path, token),
  );

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
