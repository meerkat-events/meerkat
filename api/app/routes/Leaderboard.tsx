import { useMemo, useState } from "react";
import {
  Box,
  chakra,
  Flex,
  Grid,
  Heading,
  Spinner,
  Text,
} from "@chakra-ui/react";
import { useParams } from "react-router";
import { useDocumentTitle } from "@uidotdev/usehooks";
import { useEvent } from "../hooks/use-event.ts";
import { useAuth } from "../hooks/use-auth.ts";
import { useLeaderboard } from "../hooks/use-leaderboard.ts";
import { useLinks } from "~/components/NavigationDrawer/use-links.ts";
import { NavigationDrawer } from "~/components/NavigationDrawer/index.tsx";
import { EntryAvatar } from "~/components/Leaderboard/EntryAvatar.tsx";
import { EntryDetails } from "~/components/Leaderboard/EntryDetails.tsx";
import {
  podiumLabel,
  podiumPaletteStyle,
  rankEntries,
} from "~/components/Leaderboard/podium.ts";

const MAX_ENTRIES = 25;

export default function Leaderboard() {
  const { uid } = useParams();
  const { data: eventData } = useEvent(uid);
  const event = eventData?.data;
  const { user } = useAuth();
  const { data: entries, scoring, isLoading, error } = useLeaderboard(
    event?.conferenceId,
  );
  const navLinks = useLinks({ event });
  const [selected, setSelected] = useState<RankedEntry>();

  useDocumentTitle(
    event?.conference.name
      ? `Leaderboard | ${event.conference.name}`
      : "Leaderboard",
  );

  const ranked = useMemo(() => rankEntries(entries ?? []), [entries]);
  const currentUserId = user?.id;
  const me = ranked.find(({ entry }) => entry.user.id === currentUserId);
  // Pinned to the bottom unless the user's own row is already in the list
  const showMe = !!currentUserId && !!entries &&
    (!me || me.rank > MAX_ENTRIES);

  return (
    <div className="layout">
      <header className="header">
        {/* Same header row as the Q&A page: menu left, conference centered */}
        <Grid
          templateColumns="1fr minmax(0, auto) 1fr"
          gap="1"
          alignItems="center"
          padding="0 1rem 0 1rem"
          marginBottom="2"
          boxShadow="0 6px 10px -8px color-mix(in srgb, var(--chakra-colors-brand-solid) 60%, transparent)"
        >
          <nav>
            <NavigationDrawer navLinks={navLinks} />
          </nav>
          <Text as="span" textStyle="sm" fontWeight="medium" truncate>
            {event?.conference.name}
          </Text>
        </Grid>
        <Box padding="0.5rem 1rem 0">
          <Heading as="h1" size="xl">Leaderboard</Heading>
        </Box>
      </header>
      <main className="content">
        {isLoading || (!event && !error)
          ? (
            <Flex justifyContent="center" padding="8">
              <Spinner />
            </Flex>
          )
          : error
          ? <EmptyState text="Couldn't load the leaderboard." />
          : ranked.length === 0
          ? <EmptyState text="Nobody's on the board yet. Ask a question!" />
          : (
            <ol className="leaderboard-list">
              {ranked.slice(0, MAX_ENTRIES).map((row) => (
                <LeaderboardRow
                  key={row.entry.user.id}
                  {...row}
                  isMe={row.entry.user.id === currentUserId}
                  onSelect={() => setSelected(row)}
                />
              ))}
            </ol>
          )}
      </main>
      {showMe && (
        // The user's own place, however far down the board they are
        <footer className="footer leaderboard-me">
          {me
            ? (
              <LeaderboardRow
                {...me}
                isMe
                as="div"
                onSelect={() => setSelected(me)}
              />
            )
            : (
              <Flex
                alignItems="center"
                gap="3"
                paddingY="2.5"
                paddingX="3"
                borderRadius="lg"
                borderWidth="1px"
                borderStyle="dashed"
                borderColor="border.emphasized"
              >
                <EntryAvatar badge={undefined} />
                <Text textStyle="sm" color="fg.muted">
                  You're not on the board yet. Ask or upvote a question to
                  join the mob!
                </Text>
              </Flex>
            )}
        </footer>
      )}
      <EntryDetails
        selected={selected && {
          ...selected,
          isMe: selected.entry.user.id === currentUserId,
        }}
        scoring={scoring}
        onClose={() => setSelected(undefined)}
      />
    </div>
  );
}

type RankedEntry = ReturnType<typeof rankEntries>[number];

type LeaderboardRowProps = RankedEntry & {
  isMe: boolean;
  as?: "li" | "div";
  /** Opens the entry's details. */
  onSelect: () => void;
};

function LeaderboardRow(
  { rank, entry, badge, isMe, as = "li", onSelect }: LeaderboardRowProps,
) {
  return (
    <Box as={as}>
      <chakra.button
        type="button"
        onClick={onSelect}
        display="flex"
        width="full"
        textAlign="start"
        alignItems="center"
        gap="3"
        paddingY="2.5"
        paddingX="3"
        borderRadius="lg"
        cursor="pointer"
        focusVisibleRing="outside"
        transition="filter 0.15s"
        _hover={{ filter: "brightness(0.97)" }}
        style={badge ? podiumPaletteStyle(badge) : undefined}
        bg={badge ? "colorPalette.subtle" : "bg.panel"}
        borderWidth="1px"
        borderColor={badge && !isMe ? "colorPalette.emphasized" : "transparent"}
        // Your own row: a neutral dark outline, drawn inside so the row keeps
        // its size, and which works with any theme and the podium colors
        boxShadow={isMe ? "inset 0 0 0 2px var(--chakra-colors-fg)" : undefined}
        aria-label={`${
          badge ? podiumLabel(badge) : `#${rank}`
        }, ${entry.user.name}${isMe ? " (you)" : ""}, ${entry.score} points. Show details`}
      >
        <EntryAvatar badge={badge} />
        <Box flex="1" minW="0">
          <Text
            textStyle="2xs"
            fontWeight="bold"
            textTransform="uppercase"
            letterSpacing="wider"
            color={badge ? "colorPalette.fg" : "fg.subtle"}
          >
            {badge ? podiumLabel(badge) : `#${rank} Mob member`}
          </Text>
          <Text truncate fontWeight="medium">
            {entry.user.name}
            {isMe && (
              <Text as="span" color="fg.muted" fontWeight="normal">
                {" "}(you)
              </Text>
            )}
          </Text>
        </Box>
        <Text flexShrink="0" textStyle="sm" color="fg.muted">
          <Text as="span" color="fg" textStyle="lg" fontWeight="bold">
            {entry.score}
          </Text>{" "}
          {entry.score === 1 ? "pt" : "pts"}
        </Text>
      </chakra.button>
    </Box>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Text textAlign="center" color="fg.muted" padding="8">
      {text}
    </Text>
  );
}
