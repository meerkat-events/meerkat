import { useEffect, useState } from "react";
import { useConferenceRoles } from "./use-conference-roles.ts";
import { fetcher } from "./fetcher.ts";
import { HTTPError } from "./http-error.ts";
import type { Event } from "../types.ts";

export function useOrganizerEvents() {
  const { data: roles, isLoading: isRolesLoading } = useConferenceRoles();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<HTTPError | undefined>();

  useEffect(() => {
    const fetchEvents = async () => {
      if (!roles) {
        setIsLoading(isRolesLoading);
        return;
      }

      // Filter to only organizer roles
      const organizerConferenceIds = roles
        .filter((role) => role.role === "organizer")
        .map((role) => role.conferenceId);

      if (organizerConferenceIds.length === 0) {
        setEvents([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const eventPromises = organizerConferenceIds.map((conferenceId) =>
          fetcher(`/api/v1/conferences/${conferenceId}/events`)
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
  }, [roles, isRolesLoading]);

  return {
    data: events,
    isLoading,
    error,
  };
}
