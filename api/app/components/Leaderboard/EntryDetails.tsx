import {
  Box,
  Button,
  CloseButton,
  Dialog,
  Flex,
  Portal,
  Text,
} from "@chakra-ui/react";
import type {
  LeaderboardEntry,
  LeaderboardScoring,
} from "../../hooks/use-leaderboard.ts";
import { Link } from "react-router";
import { EntryAvatar } from "./EntryAvatar.tsx";
import { type PodiumBadge, podiumLabel, podiumPaletteStyle } from "./podium.ts";

export type EntryDetailsProps = {
  /** The entry to show; the dialog is closed while undefined. */
  selected:
    | {
      entry: LeaderboardEntry;
      rank: number;
      badge: PodiumBadge | undefined;
      isMe: boolean;
    }
    | undefined;
  scoring: LeaderboardScoring | undefined;
  /**
   * The leaderboard page. When set (opened from the Q&A page), the dialog
   * offers to open it.
   */
  leaderboardHref?: string | undefined;
  onClose: () => void;
};

const plural = (count: number, singular: string, plural: string) =>
  `${count} ${count === 1 ? singular : plural}`;

/**
 * Deep dive on one leaderboard entry: who they are, their place, and how
 * each kind of participation added up to their points.
 */
export function EntryDetails(
  { selected, scoring, leaderboardHref, onClose }: EntryDetailsProps,
) {
  return (
    <Dialog.Root
      placement="center"
      motionPreset="scale"
      open={!!selected}
      onOpenChange={(details) => !details.open && onClose()}
      lazyMount
      unmountOnExit
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="sm" mx="4">
            {selected && (
              <Details {...selected} scoring={scoring} />
            )}
            {selected && leaderboardHref && (
              <Dialog.Footer
                flexDirection="column"
                alignItems="stretch"
                paddingTop="0"
              >
                <Button asChild>
                  <Link to={leaderboardHref}>See the leaderboard</Link>
                </Button>
              </Dialog.Footer>
            )}
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" color="fg.muted" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

function Details(
  { entry, rank, badge, isMe, scoring }:
    & NonNullable<EntryDetailsProps["selected"]>
    & { scoring: LeaderboardScoring | undefined },
) {
  const lines = [
    {
      label: plural(entry.questions, "question asked", "questions asked"),
      points: entry.questions * (scoring?.question ?? 0),
    },
    {
      label: plural(entry.picked, "question answered", "questions answered"),
      points: entry.picked * (scoring?.picked ?? 0),
    },
    {
      label: plural(entry.received, "vote received", "votes received"),
      points: entry.received * (scoring?.received ?? 0),
    },
    {
      label: plural(entry.given, "vote given", "votes given"),
      points: entry.given * (scoring?.given ?? 0),
    },
  ];

  return (
    <Box style={badge ? podiumPaletteStyle(badge) : undefined}>
      <Dialog.Header
        flexDirection="column"
        alignItems="center"
        textAlign="center"
        gap="2"
        paddingTop="6"
      >
        <EntryAvatar badge={badge} size="20" />
        <Text
          textStyle="2xs"
          fontWeight="bold"
          textTransform="uppercase"
          letterSpacing="wider"
          color={badge ? "colorPalette.fg" : "fg.subtle"}
        >
          {badge ? podiumLabel(badge) : `#${rank} Mob member`}
        </Text>
        <Dialog.Title textStyle="lg" lineClamp={2}>
          {entry.user.name}
          {isMe && (
            <Text as="span" color="fg.muted" fontWeight="normal">
              {" "}(you)
            </Text>
          )}
        </Dialog.Title>
        {badge && (
          <Dialog.Description
            textStyle="sm"
            color="fg.muted"
            // Even lines, so a last word ("mob)") doesn't hang on its own
            textWrap="balance"
          >
            {badge.description}
          </Dialog.Description>
        )}
      </Dialog.Header>
      <Dialog.Body paddingBottom="5">
        <Box
          as="dl"
          borderRadius="lg"
          bg="bg.muted"
          paddingX="4"
          paddingY="1"
        >
          {lines.map(({ label, points }) => (
            <Flex
              key={label}
              // Zero lines stay, as a hint of how to earn points, but muted
              color={points ? "fg" : "fg.subtle"}
              justifyContent="space-between"
              gap="3"
              paddingY="2.5"
              textStyle="sm"
              borderBottomWidth="1px"
              borderColor="border"
              _last={{ borderBottomWidth: "0" }}
            >
              <Text as="dt">{label}</Text>
              <Text as="dd" color="fg.muted" flexShrink="0">
                +{plural(points, "pt", "pts")}
              </Text>
            </Flex>
          ))}
        </Box>
        <Flex
          justifyContent="space-between"
          paddingX="4"
          paddingTop="3"
          fontWeight="bold"
        >
          <Text>Total</Text>
          <Text>{plural(entry.score, "pt", "pts")}</Text>
        </Flex>
      </Dialog.Body>
    </Box>
  );
}
