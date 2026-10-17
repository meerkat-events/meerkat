import type { CSSProperties } from "react";
import type { Tier } from "../../types.ts";

/** Best first, like the API's tiers. */
export const TIERS: readonly Tier[] = [0.1, 1, 10, 25];

/** A smaller share is better: the top 1% beats the top 10%. */
export const isBetterTier = (tier: Tier, than: Tier | null) =>
  than === null || tier < than;

export const tierLabel = (tier: Tier) => `Top ${tier}%`;

// Gold, silver and bronze for the top three tiers, then teal
const PALETTES: Record<Tier, string> = {
  0.1: "yellow",
  1: "gray",
  10: "orange",
  25: "teal",
};

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

/** The supervote gold (QnA/Supervote.css). */
const GOLD = "#F6B613";

/**
 * Each tier's accent on the profile card, read through CSS vars:
 * --tier-accent fills the tier pill and the medal behind the mascot,
 * --tier-accent-fg is the pill's text, --tier-ring rings the medal and
 * --tier-pill-ring the pill. By default the palette's subtle shade and its fg
 * text inside the emphasized shade, with no ring on the pill. Gold is light
 * yellow inside the supervote gold, on the medal and the pill alike; the
 * same in both color modes, so its text is a dark yellow that keeps 4.5:1 in
 * both.
 */
const ACCENTS: Partial<
  Record<Tier, { color: string; fg: string; ring: string; pillRing: string }>
> = {
  0.1: {
    color: "var(--chakra-colors-yellow-300)",
    fg: "var(--chakra-colors-yellow-900)",
    ring: GOLD,
    pillRing: GOLD,
  },
};

/**
 * Inline style that points Chakra's color-palette vars at the tier's color,
 * so `colorPalette.*` tokens and plain CSS using
 * `--chakra-colors-color-palette-*` both follow it (inline vars also reach
 * portals and non-Chakra elements, unlike the colorPalette prop). It also
 * sets the tier's accent vars (see ACCENTS).
 */
export function tierPaletteStyle(tier: Tier) {
  const palette = PALETTES[tier];
  const accent = ACCENTS[tier];
  return {
    ...Object.fromEntries(
      PALETTE_TOKENS.map((token) => [
        `--chakra-colors-color-palette-${token}`,
        `var(--chakra-colors-${
          OVERRIDES[palette]?.[token] ?? `${palette}-${token}`
        })`,
      ]),
    ),
    "--tier-accent": accent?.color ?? "var(--chakra-colors-color-palette-subtle)",
    "--tier-accent-fg": accent?.fg ?? "var(--chakra-colors-color-palette-fg)",
    "--tier-ring": accent?.ring ??
      "var(--chakra-colors-color-palette-emphasized)",
    "--tier-pill-ring": accent?.pillRing ?? "transparent",
  } as CSSProperties;
}

