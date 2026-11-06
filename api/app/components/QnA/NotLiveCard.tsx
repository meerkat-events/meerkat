import { Alert, Button, Flex, Icon } from "@chakra-ui/react";
import { LuCalendarClock } from "react-icons/lu";
import { Link } from "react-router";
import { qa } from "../../routing.ts";
import type { Event } from "../../types.ts";
import { LiveDialog } from "./LiveDialog.tsx";

type NotLiveCardProps = {
  event: Event;
  /** The session live on this event's stage now, if it is another one. */
  liveSession: { uid: string; title: string } | undefined;
  /** Moderators get Go Live instead of Jump to Live. */
  canModerate: boolean;
  onGoLive: () => Promise<void>;
};

/**
 * A notification card under the session title in the top bar: this isn't
 * the session on stage right now.
 */
export function NotLiveCard(
  { event, liveSession, canModerate, onGoLive }: NotLiveCardProps,
) {
  return (
    <Alert.Root
      status="info"
      width="full"
      display="flex"
      flexDirection="row"
      alignItems="center"
      gap="3"
      padding="2.5"
      paddingInlineStart="3"
      borderRadius="15px"
      bg="bg.panel"
      color="fg"
      // A light lift, much softer than the floating heart bubble's
      boxShadow="xs"
      marginBlock="1"
    >
      {/* In the colorway, like the session title's chevron circle: the
          brand tint behind the icon, the brand color for it */}
      <Flex
        aria-hidden="true"
        alignItems="center"
        justifyContent="center"
        flexShrink="0"
        boxSize="8"
        borderRadius="full"
        bg="segment.track"
        color="brand.fg"
      >
        <Icon as={LuCalendarClock} boxSize="4" />
      </Flex>
      <Alert.Content flex="1" minW="0">
        <Alert.Title textStyle="sm" fontWeight="medium">
          You're viewing a past or upcoming event.
        </Alert.Title>
      </Alert.Content>
      {/* Moderators get Go Live instead: two live buttons side by side read
          alike */}
      {liveSession && !canModerate && (
        <Button
          asChild
          size="sm"
          colorPalette="brand"
          flexShrink="0"
          whiteSpace="nowrap"
        >
          <Link to={qa(liveSession.uid)} title={liveSession.title}>
            Jump to Live
          </Link>
        </Button>
      )}
      {canModerate && <LiveDialog event={event} onConfirm={onGoLive} />}
    </Alert.Root>
  );
}
