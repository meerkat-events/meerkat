import type { Ref } from "react";
import { Box, chakra, Text } from "@chakra-ui/react";
import { PodiumMeerkat } from "./PodiumMeerkat.tsx";
import {
  type PodiumBadge,
  podiumLabel,
  podiumPaletteStyle,
} from "./podium.ts";
import type { PodiumChange } from "../../hooks/use-podium-change.ts";
import "./Podium.css";

export type PodiumStatusProps = {
  /** The user's place on the leaderboard, if they're on it. */
  rank: number | undefined;
  /** The user's current podium badge, if they're in the top three. */
  badge: PodiumBadge | undefined;
  /**
   * Set for a few seconds after the user's place changed. Moving up is
   * celebrated full-screen instead (see PodiumCelebration), so the header
   * only labels moving down or off the podium.
   */
  change: PodiumChange | undefined;
  /** Hides the badge (keeping its space) until the celebration's meerkat lands. */
  pending?: boolean;
  /** Bumped when the celebration's meerkat lands, to pop and glow. */
  landedKey?: number;
  /** Opens the user's leaderboard details. */
  onOpen: () => void;
  ref?: Ref<HTMLDivElement>;
};

const label = ({ kind, to }: PodiumChange) =>
  kind === "lost" || !to
    ? "Out of the top 3. Keep asking!"
    : `Down to ${podiumLabel(to)}`;

/**
 * The user's leaderboard place in the header: their meerkat (gold, silver or
 * bronze in the top three, black and white below) and their place. Animated
 * when their place changes: a pop and glow when the celebration's meerkat
 * lands, a wobble moving down, and the old meerkat tipping over when they
 * drop off the podium.
 */
export function PodiumStatus(
  { rank, badge, change, pending, landedKey, onOpen, ref }: PodiumStatusProps,
) {
  // After dropping off, keep showing the old meerkat until it has tipped over
  const lostBadge = change?.kind === "lost" ? change.from : undefined;
  const shown = badge ?? lostBadge;
  if (!shown && !rank) return null;

  const headerChange = change?.kind === "up" ? undefined : change;
  const state = pending
    ? "pending"
    : headerChange
    ? headerChange.kind
    : landedKey
    ? "up"
    : undefined;

  return (
    <Box
      ref={ref}
      className={`podium-status${state ? ` podium-status-${state}` : ""}`}
      // Keyed on the change so a new one restarts the animations
      key={headerChange
        ? `${headerChange.kind}-${headerChange.from?.rank}-${headerChange.to?.rank}`
        : `landed-${landedKey ?? 0}`}
      style={shown ? podiumPaletteStyle(lostBadge ?? shown) : undefined}
    >
      <chakra.button
        type="button"
        onClick={onOpen}
        display="inline-flex"
        alignItems="center"
        gap="1.5"
        height="7"
        paddingRight={rank ? "2.5" : "0"}
        borderRadius="full"
        cursor="pointer"
        bg={rank ? "brand.solid/20" : "transparent"}
        focusVisibleRing="outside"
        title={badge
          ? `You're ${podiumLabel(badge)}. ${badge.description}`
          : undefined}
        aria-label={rank
          ? `You're #${rank}${
            badge ? ` ${badge.title}` : ""
          } on the leaderboard. Show details`
          : "Your leaderboard place"}
      >
        <Box
          className="my-podium-badge"
          flexShrink="0"
          width="7"
          height="7"
          borderRadius="full"
          overflow="hidden"
          bg={shown ? "colorPalette.muted" : "bg.muted"}
          borderWidth="2px"
          borderColor={shown ? "colorPalette.solid" : "border.emphasized"}
          // Below the top three: the plain meerkat in black and white
          filter={shown ? undefined : "grayscale(1)"}
        >
          <PodiumMeerkat role={shown?.role ?? "member"} />
        </Box>
        {rank && (
          <Text
            as="span"
            textStyle="sm"
            fontWeight="semibold"
            fontVariantNumeric="tabular-nums"
          >
            #{rank}
          </Text>
        )}
      </chakra.button>
      {headerChange && (
        <span className="podium-status-label" role="status">
          {label(headerChange)}
        </span>
      )}
    </Box>
  );
}
