import useSWR from "swr";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";
import { useAuth } from "./use-auth.ts";

import type { ModerationReason } from "../components/Manage/question-state.ts";
import type { ReactionEmoji } from "../../reactions.ts";

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

/** Someone with points at the conference, for organizers. */
export type Contributor = {
  userId: string;
  name: string;
  points: number;
  /** Their questions picked for the stage. */
  picked: number;
  /** Votes on their questions from others, weighted. */
  votesReceived: number;
};

export type ConferenceStats = {
  totals: ActivityCounts;
  /** Every reaction emoji, most used first. */
  reactions: { emoji: ReactionEmoji; count: number }[];
  supervotes: {
    enabled: boolean;
    /** Earned by authors whose question was picked. */
    received: number;
    /** Spent on questions. */
    given: number;
  };
  moderation: ModerationStats;
  events: (SessionCounts & { eventId: number })[];
  /** The ten with the most points across the whole conference. */
  topContributors: Contributor[];
};

/** A span of time, from inclusive to `to` exclusive. */
export type TimeWindow = { from: Date; to: Date };

/**
 * Activity totals for a conference and each session (organizers only); with
 * a `window`, only what happened in it.
 */
export function useConferenceStats(
  conferenceId: number | undefined,
  window?: TimeWindow,
) {
  const { session } = useAuth();
  const token = session?.access_token;
  const query = window
    ? `?${new URLSearchParams({ from: window.from.toISOString(), to: window.to.toISOString() })}`
    : "";

  const { data, error, isLoading, mutate } = useSWR<
    { data: ConferenceStats },
    HTTPError
  >(
    conferenceId && token
      ? [`/api/v1/conferences/${conferenceId}/stats${query}`, token]
      : undefined,
    ([path, token]: [string, string]) => fetcher(path, token),
    { refreshInterval: 15_000 },
  );

  return { data: data?.data, error, isLoading, mutate };
}
