import { Box, Flex, Text } from "@chakra-ui/react";
import { PodiumMeerkat } from "./PodiumMeerkat.tsx";
import {
  type PodiumBadge,
  podiumLabel,
  podiumPaletteStyle,
} from "./podium.ts";

export type PodiumTagProps = {
  /** The author's place on the leaderboard. */
  rank: number;
  /** Their badge, in the top three. */
  badge: PodiumBadge | undefined;
  /** Opens the author's leaderboard details. */
  onSelect: () => void;
};

/**
 * Compact leaderboard place for bylines. The top three get their role's
 * meerkat, place and title in gold / silver / bronze; everyone else a quiet
 * pill with the plain meerkat in black and white and their place, so the
 * top three still stand out. Tapping explains it.
 */
export function PodiumTag({ rank, badge, onSelect }: PodiumTagProps) {
  return (
    <Flex
      asChild
      flexShrink="0"
      alignItems="center"
      gap="1"
      paddingRight="2"
      borderRadius="full"
      style={badge ? podiumPaletteStyle(badge) : undefined}
      bg={badge ? "colorPalette.subtle" : "bg.muted"}
      transition="background-color 0.15s"
      _hover={{ bg: badge ? "colorPalette.muted" : "bg.emphasized" }}
      focusVisibleRing="outside"
      title={badge?.description}
      aria-label={`${
        badge ? podiumLabel(badge) : `#${rank}`
      } on the leaderboard. Show details`}
    >
      <button type="button" onClick={onSelect}>
        <Box
          as="span"
          width="6"
          height="6"
          borderRadius="full"
          overflow="hidden"
          bg={badge ? "colorPalette.muted" : "bg.emphasized"}
          filter={badge ? undefined : "grayscale(1)"}
          opacity={badge ? undefined : 0.75}
        >
          <PodiumMeerkat role={badge?.role ?? "member"} />
        </Box>
        <Text
          as="span"
          textStyle="2xs"
          fontWeight="bold"
          textTransform="uppercase"
          letterSpacing="wider"
          color={badge ? "colorPalette.fg" : "fg.muted"}
        >
          {badge ? podiumLabel(badge) : `#${rank}`}
        </Text>
      </button>
    </Flex>
  );
}
