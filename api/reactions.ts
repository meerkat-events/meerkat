/**
 * Reactions attendees can send during a session. "heart" is the one-tap
 * default; the others live in the heart button's expandable tray. Shared by
 * the API (validation) and the frontend (rendering).
 */
export const REACTION_EMOJIS = [
  "heart",
  "fire",
  "star-struck",
  "clap",
] as const;

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

/** Emoji characters for the non-heart reactions (the heart is a custom SVG). */
export const REACTION_GLYPHS: Record<Exclude<ReactionEmoji, "heart">, string> =
  {
    fire: "🔥",
    "star-struck": "🤩",
    clap: "👏",
  };

export const REACTION_LABELS: Record<ReactionEmoji, string> = {
  heart: "Heart",
  fire: "Fire",
  "star-struck": "Star-struck",
  clap: "Clap",
};
