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
  /**
   * Selected rows, and the hover of icon and outline buttons, menu items and
   * votes.
   */
  highlightColor?: string;
  /** Color of every shadow. */
  shadowColor?: string;
  /** Outline around text inputs at rest. */
  inputOutlineColor?: string;
  /**
   * Background of confirmation (success) toasts, whose text then takes
   * textColor; defaults to the brand color with contrastColor text.
   */
  successToastColor?: string;
  /**
   * Background of the banner on events that aren't live, whose text then
   * takes textColor; defaults to a brand tint with brand text.
   */
  notLiveBannerColor?: string;
  /** Corners of every button, including icon and close buttons; defaults to l2. */
  buttonRadius?: string;
  /** Label weight of every button except the vote pill; defaults to medium. */
  buttonFontWeight?: string;
  /**
   * Corners of the question input. It grows with its text, so a value above
   * half its one-line height clips multi-line questions; defaults to md.
   */
  questionInputRadius?: string;
  /** Vertical position of dialogs that don't set their own; defaults to "top". */
  dialogPlacement?: "top" | "center";
  /** Space between a dialog and the sides of a narrow screen; defaults to none. */
  dialogGutter?: string;
  /** Weight of dialog titles; defaults to semibold. */
  dialogTitleFontWeight?: string;
  /** Space below a dialog's title, before the body's own 0.5rem; defaults to 1rem. */
  dialogTitleSpacing?: string;
  /** Size of a dialog's close (X) icon; defaults to 1rem. */
  dialogCloseIconSize?: string;
  /**
   * Weight of emphasized text in dialogs, such as the event in the Go Live
   * dialog; defaults to bold.
   */
  dialogEmphasisFontWeight?: string;
  /** Arrow and count of a vote you haven't cast; defaults to accentColor. */
  voteTextColor?: string;
  /** Border of a vote you haven't cast; defaults to brandColor. */
  voteOutlineColor?: string;
  /**
   * Height of the vote pill and size of a question's options button;
   * defaults to Chakra's small button (36px).
   */
  questionControlSize?: string;
  /**
   * Minimum tappable size of those controls, reached with an invisible hit
   * area so their look and layout stay the same.
   */
  minTapTarget?: string;
  /** Space between question cards; defaults to 1.125rem. */
  questionGap?: string;
  /** Space below the header bar (conference name); defaults to 0.5rem. */
  headerBarSpacing?: string;
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

