import type { PODData } from "@parcnet-js/podspec";
import type { ReactionEmoji } from "../reactions.ts";
export type Theme = {
  brandColor: string;
  contrastColor: string;
  background: string;
  textColor: string;
  systemTheme?: "dark" | "light";
  headingFontFamily?: string;
  bodyFontFamily?: string;
  // Optional refinements (see theme/index.ts). Leaving one out keeps the
  // default look for that part.
  /** Hover background of the brand's solid buttons. */
  brandHoverColor?: string;
  /** Secondary text and icons; defaults to textColor at 70% opacity. */
  mutedTextColor?: string;
  /** Links, small text actions, action icons and the vote pill. */
  accentColor?: string;
  /** Selected rows, and the hover of icon buttons, menu items and votes. */
  highlightColor?: string;
  /** Color of every shadow. */
  shadowColor?: string;
  /** Outline around text inputs at rest. */
  inputOutlineColor?: string;
  /**
   * Fixed width of the session list's time column, so titles line up with
   * fonts whose digits differ in width (no tabular figures, e.g. Poppins).
   */
  sessionTimeWidth?: string;
};

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
  start: Date;
  end: Date;
  description: string | null;
  cover: string | null;
  questions: Question[];
  votes: number;
  participants: number;
  speaker: string;
  stage: string;
  conference: Conference;
  live: boolean;
};
export type Question = {
  id: number;
  eventId: number;
  uid: string;
  votes: number;
  question: string;
  createdAt: Date;
  answeredAt?: Date | undefined;
  selectedAt?: Date | undefined;
  user?: {
    id: string;
    name?: string | undefined;
  } | undefined;
};

export type EventPod = {
  uid: string;
  event: Event;
  pod: PODData;
  createdAt: Date;
};

export type Reaction = {
  created_at: string;
  event_id: number;
  uid: string;
  emoji?: ReactionEmoji | undefined;
};

