import { useEffect, useState } from "react";
import { canModerate, useConferenceRoles } from "./use-conference-roles.ts";
import { fetcher } from "./fetcher.ts";
import { useAuth } from "./use-auth.ts";
import { HTTPError } from "./http-error.ts";
import type { Event } from "../types.ts";

/** Every session of the conferences this person organizes or moderates. */
export function useModeratedEvents() {
  const { session } = useAuth();
  const token = session?.access_token;
  const { data: roles, isLoading: isRolesLoading } = useConferenceRoles();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<HTTPError | undefined>();

  useEffect(() => {
    const fetchEvents = async () => {
      if (!roles || !token) {
        setIsLoading(isRolesLoading);
        return;
      }

      const moderatedConferenceIds = roles
        .filter(canModerate)
        .map((role) => role.conferenceId);

      if (moderatedConferenceIds.length === 0) {
        setEvents([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const eventPromises = moderatedConferenceIds.map((conferenceId) =>
          fetcher(`/api/v1/conferences/${conferenceId}/events`, token)
        );

        const results = await Promise.all(eventPromises);
        const allEvents = results.flatMap((result) => result.data);

        setEvents(allEvents);
        setError(undefined);
      } catch (err) {
        setError(err as HTTPError);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, [roles, isRolesLoading, token]);

  return {
    data: events,
    isLoading,
    error,
  };
}
