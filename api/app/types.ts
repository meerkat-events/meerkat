import type { Theme } from "../conference-theme.ts";
import type { Tier } from "../tiers.ts";

export type Conference = {
  id: number;
  name: string;
  logoUrl: string | null;
  theme: Theme | null;
  features: Record<string, boolean>;
};

export type Event = {
  id: number;
  uid: string;
  conferenceId: number;
  title: string;
  // Timestamps are ISO strings, as the API's JSON sends them; parse them with
  // `new Date()` where a date is needed.
  start: string;
  end: string;
  description: string | null;
  cover: string | null;
  questions: Question[];
  speaker: string;
  stage: string;
  conference: Conference;
  live: boolean;
  /**
   * The presenter view shows only the question being answered, with
   * `recentlyAnswered` below it.
   */
  highEngagement: boolean;
  /** The latest answered questions, newest first; empty unless highEngagement. */
  recentlyAnswered: Question[];
};
export type Question = {
  id: number;
  eventId: number;
  uid: string;
  votes: number;
  question: string;
  createdAt: string;
  answeredAt?: string | undefined;
  selectedAt?: string | undefined;
  user?: {
    id: string;
    name?: string | undefined;
  } | undefined;
  /**
   * The signed-in viewer's vote on the question, or null. Only in the event's
   * question list fetched with a token (`useEventQuestions`) and the
   * organizers' conference question list (`useConferenceQuestions`).
   */
  vote?: { weight: number } | null | undefined;
  /**
   * How relevant automatic moderation found the question, 0 to 4, or null
   * when it wasn't scored. Only in the event's question list fetched by an
   * organizer or moderator of its conference.
   */
  relevance?: number | null | undefined;
};

export type { Tier };

/** Someone's points at a conference (`GET .../participants/:userId`). */
export type Participant = {
  user: { id: string; name: string };
  points: number;
  /** Their questions a moderator selected for the stage. */
  picked: number;
  /** Votes on their questions; a supervote counts as several. */
  votesReceived: number;
  tier: Tier | null;
  /** Everyone who asked or voted at the conference. */
  contributors: number;
};

export type PointsScoring = {
  picked: number;
  vote: number;
};

