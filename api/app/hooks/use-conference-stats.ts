import useSWR from "swr";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";
import { useAuth } from "./use-auth.ts";

import type { ModerationReason } from "../components/Manage/question-state.ts";

/** What attendees did; moderation-hidden questions are not counted. */
export type ActivityCounts = {
  questions: number;
  votes: number;
  reactions: number;
  participants: number;
};

export type SessionCounts = ActivityCounts & {
  /** Questions automatic moderation hid and nobody restored. */
  autoHidden: number;
  /** Questions moderation marked for an organizer to check. */
  review: number;
  /** Average relevance (0 to 4) of the questions attendees saw. */
  relevance: number | null;
};

/** What automatic moderation did across the conference. */
export type ModerationStats = {
  enabled: boolean;
  classified: number;
  autoHidden: number;
  restored: number;
  review: number;
  refused: number;
  /** Hidden questions (including restored ones) per reason. */
  reasons: Partial<Record<ModerationReason, number>>;
  relevance: {
    average: number | null;
    scored: number;
    /** How many scored about 0, 1, 2, 3 and 4. */
    distribution: [number, number, number, number, number];
  };
};

export type ConferenceStats = {
  totals: ActivityCounts;
  moderation: ModerationStats;
  events: (SessionCounts & { eventId: number })[];
};

/** Activity totals for a conference and each session (organizers only). */
export function useConferenceStats(conferenceId: number | undefined) {
  const { session } = useAuth();
  const token = session?.access_token;

  const { data, error, isLoading, mutate } = useSWR<
    { data: ConferenceStats },
    HTTPError
  >(
    conferenceId && token
      ? [`/api/v1/conferences/${conferenceId}/stats`, token]
      : undefined,
    ([path, token]: [string, string]) => fetcher(path, token),
    { refreshInterval: 15_000 },
  );

  return { data: data?.data, error, isLoading, mutate };
}
