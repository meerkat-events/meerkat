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

/**
 * Inline style that points Chakra's color-palette vars at the tier's color,
 * so `colorPalette.*` tokens and plain CSS using
 * `--chakra-colors-color-palette-*` both follow it (inline vars also reach
 * portals and non-Chakra elements, unlike the colorPalette prop).
 */
export function tierPaletteStyle(tier: Tier) {
  const palette = PALETTES[tier];
  return Object.fromEntries(
    PALETTE_TOKENS.map((token) => [
      `--chakra-colors-color-palette-${token}`,
      `var(--chakra-colors-${
        OVERRIDES[palette]?.[token] ?? `${palette}-${token}`
      })`,
    ]),
  ) as CSSProperties;
}
