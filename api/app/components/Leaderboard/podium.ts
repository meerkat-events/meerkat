import type { CSSProperties } from "react";
import type { LeaderboardEntry } from "../../hooks/use-leaderboard.ts";
import type { PodiumRole } from "./PodiumMeerkat.tsx";

export type PodiumBadge = {
  rank: 1 | 2 | 3;
  role: PodiumRole;
  title: string;
  description: string;
  /** Chakra palette that tints the badge gold / silver / bronze. */
  palette: string;
};

// Meerkat roles for the top three
export const BADGES: Record<number, PodiumBadge> = {
  1: {
    rank: 1,
    role: "boss",
    title: "Mob Boss",
    description: "Leads the mob (yes, a group of meerkats is called a mob)",
    palette: "yellow",
  },
  2: {
    rank: 2,
    role: "sentinel",
    title: "Sentinel",
    description: "Stands guard on lookout for the whole mob",
    palette: "gray",
  },
  3: {
    rank: 3,
    role: "builder",
    title: "Burrow Builder",
    description: "Digs deep and keeps the mob's burrow buzzing",
    palette: "orange",
  },
};

/**
 * "#1 Mob Boss": the place always goes with the title, since the titles alone
 * mean nothing to someone who hasn't seen the leaderboard.
 */
export const podiumLabel = ({ rank, title }: PodiumBadge) => `#${rank} ${title}`;

const PALETTE_TOKENS = [
  "solid",
  "muted",
  "subtle",
  "emphasized",
  "fg",
  "contrast",
] as const;

// Chakra's gray "solid" is near-black; silver needs a light metal instead.
const OVERRIDES: Record<string, Partial<Record<string, string>>> = {
  gray: { solid: "gray-400", contrast: "gray-900" },
};

/**
 * Inline style that points Chakra's color-palette vars at the badge's
 * gold / silver / bronze, so `colorPalette.*` tokens and plain CSS using
 * `--chakra-colors-color-palette-*` both follow it (inline vars also reach
 * portals and non-Chakra elements, unlike the colorPalette prop).
 */
export const podiumPaletteStyle = ({ palette }: PodiumBadge) =>
  Object.fromEntries(
    PALETTE_TOKENS.map((token) => [
      `--chakra-colors-color-palette-${token}`,
      `var(--chakra-colors-${
        OVERRIDES[palette]?.[token] ?? `${palette}-${token}`
      })`,
    ]),
  ) as CSSProperties;

/** Someone's spot on the board: their place, and badge in the top three. */
export type LeaderboardPlace = {
  rank: number;
  badge: PodiumBadge | undefined;
};

// Entries arrive in board order (the API breaks every tie), so each place is
// unique and there is always one Mob Boss, one Sentinel and one Burrow Builder
export function rankEntries(entries: LeaderboardEntry[]) {
  return entries.map((entry, index) => {
    const rank = index + 1;
    return { entry, rank, badge: BADGES[rank] };
  });
}
