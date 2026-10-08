import { Box } from "@chakra-ui/react";
import { PodiumMeerkat } from "./PodiumMeerkat.tsx";
import type { PodiumBadge } from "./podium.ts";

export type EntryAvatarProps = {
  /** The top three's badge; everyone else gets the plain member meerkat. */
  badge: PodiumBadge | undefined;
  /** Chakra size token, e.g. "14" on the board, "24" in the details. */
  size?: string;
};

/**
 * A leaderboard entry's meerkat: the badge's role in its gold / silver /
 * bronze for the top three (the parent sets the palette vars), and a plain
 * meerkat in black and white for everyone else so the top three stand out.
 */
export function EntryAvatar({ badge, size = "14" }: EntryAvatarProps) {
  return (
    <Box
      flexShrink="0"
      width={size}
      height={size}
      borderRadius="full"
      overflow="hidden"
      bg={badge ? "colorPalette.muted" : "bg.muted"}
      filter={badge ? undefined : "grayscale(1)"}
      opacity={badge ? undefined : 0.75}
      aria-hidden="true"
    >
      <PodiumMeerkat role={badge?.role ?? "member"} />
    </Box>
  );
}
