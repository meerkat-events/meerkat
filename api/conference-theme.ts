/**
 * A conference's look (`conferences.theme`, JSONB), which app/theme/index.ts
 * turns into a Chakra system. DB-free, so the schema and the frontend share
 * it.
 */
export type Theme = {
  brandColor: string;
  contrastColor: string;
  background: string;
  /**
   * An opaque color close to the background, for a question card moving
   * over others. Defaults to the background's colors, mixed (see
   * pageSurface in app/theme/index.ts).
   */
  surfaceColor?: string;
  textColor: string;
  systemTheme?: "dark" | "light";
  headingFontFamily?: string;
  bodyFontFamily?: string;
  // Optional refinements (see app/theme/index.ts). Leaving one out keeps the
  // default look for that part.
  /** Hover background of the brand's solid buttons. */
  brandHoverColor?: string;
  /** Secondary text and icons; defaults to textColor at 70% opacity. */
  mutedTextColor?: string;
  /** Links, small text actions, action icons and the vote pill. */
  accentColor?: string;
  /**
   * Selected rows and text, and the hover of icon and outline buttons, menu
   * items and votes.
   */
  highlightColor?: string;
  /** Color of every shadow. */
  shadowColor?: string;
  /**
   * Full box-shadow of the floating heart button and its reaction bar;
   * defaults to one drawn in shadowColor.
   */
  floatingShadow?: string;
  /** Outline around text inputs at rest. */
  inputOutlineColor?: string;
  /**
   * Background of confirmation (success) toasts, whose text then takes
   * textColor; defaults to the brand color with contrastColor text.
   */
  successToastColor?: string;
  /**
   * Background of error toasts, whose text then takes textColor; defaults to
   * Chakra's red with white text.
   */
  errorToastColor?: string;
  /** Corners of every button, including icon and close buttons; defaults to l2. */
  buttonRadius?: string;
  /** Label weight of every button except the vote pill; defaults to medium. */
  buttonFontWeight?: string;
  /**
   * Corners of the question input. It grows with its text, so a value above
   * half its one-line height clips multi-line questions; defaults to that
   * half, a pill on one line.
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
