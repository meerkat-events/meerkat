import { useRef, useState } from "react";
import { FiChevronDown } from "react-icons/fi";
import { LuCheck } from "react-icons/lu";
import {
  Box,
  chakra,
  CloseButton,
  Dialog,
  Heading,
  Icon,
  Portal,
  Spinner,
  Text,
  VisuallyHidden,
} from "@chakra-ui/react";
import { Link, useNavigation } from "react-router";
import { qa } from "../../routing.ts";
import { tapTargetStyles } from "../../theme/index.ts";

export type SessionItem = {
  uid: string;
  title: string;
  live: boolean;
  start: Date | string;
};

interface SessionSwitcherProps {
  title: string | undefined;
  stage: string | undefined;
  /** The session the page shows, marked in the list. */
  currentUid: string | undefined;
  past: SessionItem[];
  live: SessionItem[];
  upcoming: SessionItem[];
}

/**
 * The session title; tapping it opens a modal listing the sessions on the
 * same stage, with times and live status.
 */
export function SessionSwitcher(
  { title, stage, currentUid, past, live, upcoming }: SessionSwitcherProps,
) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <Box minW="0">
      <Dialog.Root
        placement="center"
        motionPreset="scale"
        scrollBehavior="inside"
        open={open}
        onOpenChange={(details) => setOpen(details.open)}
        // Focus the modal itself so no row shows a focus ring on open.
        initialFocusEl={() => contentRef.current}
        lazyMount
        unmountOnExit
      >
        <Heading
          as="h1"
          // Same type as the rest of the top bar
          fontFamily="body"
          textStyle="sm"
          fontWeight="medium"
          color="fg"
        >
          <Dialog.Trigger asChild>
            <chakra.button
              type="button"
              position="relative"
              display="inline-flex"
              alignItems="center"
              gap="1.5"
              maxW="full"
              textAlign="start"
              cursor="pointer"
              borderRadius="l1"
              focusVisibleRing="outside"
              {...tapTargetStyles}
            >
              {/* One line: long titles truncate, the chevron stays visible */}
              <chakra.span minW="0" truncate>
                {title ?? "Loading..."}
              </chakra.span>
              {/* In a brand-tinted circle, like the sort control's track,
                  so it reads as a button and not as part of the title */}
              <chakra.span
                display="inline-flex"
                alignItems="center"
                justifyContent="center"
                flexShrink="0"
                boxSize="5"
                borderRadius="full"
                bg="segment.track"
              >
                <Icon as={FiChevronDown} boxSize="3.5" color="brand.fg" />
              </chakra.span>
              <VisuallyHidden>Change session</VisuallyHidden>
            </chakra.button>
          </Dialog.Trigger>
        </Heading>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content ref={contentRef} maxW="sm" mx="4" maxH="75dvh">
              <Dialog.Header paddingBlock="3">
                <Box>
                  <Dialog.Title textStyle="md">Sessions</Dialog.Title>
                  {stage && (
                    <Dialog.Description textStyle="sm" color="fg.muted">
                      {stage} stage
                    </Dialog.Description>
                  )}
                </Box>
              </Dialog.Header>
              <Dialog.Body paddingTop="0" paddingInline="3" paddingBottom="4">
                {past.length + live.length + upcoming.length === 0
                  ? (
                    <Text textStyle="sm" color="fg.muted" paddingInline="3">
                      No other sessions are scheduled on this stage today.
                    </Text>
                  )
                  : (
                    <>
                      <SessionGroup
                        label="Past"
                        sessions={past}
                        currentUid={currentUid}
                      />
                      <SessionGroup
                        label="Live"
                        sessions={live}
                        currentUid={currentUid}
                      />
                      <SessionGroup
                        label="Next"
                        sessions={upcoming}
                        currentUid={currentUid}
                      />
                    </>
                  )}
              </Dialog.Body>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" color="fg.muted" />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Box>
  );
}

function SessionGroup(
  { label, sessions, currentUid }: {
    label: string;
    sessions: SessionItem[];
    currentUid: string | undefined;
  },
) {
  if (sessions.length === 0) return null;
  return (
    <Box as="section" mb="2">
      <Text textStyle="xs" color="fg.muted" paddingInline="3" paddingBlock="1">
        {label}
      </Text>
      <Box as="ul" listStyleType="none">
        {sessions.map((session) => (
          <li key={session.uid}>
            <SessionRow
              session={session}
              selected={session.uid === currentUid}
            />
          </li>
        ))}
      </Box>
    </Box>
  );
}

function SessionRow(
  { session, selected }: { session: SessionItem; selected: boolean },
) {
  // A switch waits for the layout's loader (the theme) before it shows the
  // new session; until then the tapped row shows that it's on its way.
  const navigation = useNavigation();
  const isSwitchingHere = navigation.location?.pathname === qa(session.uid);

  const content = (
    <>
      <Text
        as="span"
        textStyle="xs"
        color="fg.muted"
        minW="10"
        w="sessionTime"
        fontVariantNumeric="tabular-nums"
      >
        {formatTime(session.start)}
      </Text>
      <Text
        as="span"
        flex="1"
        textStyle="sm"
        fontWeight={selected ? "semibold" : "normal"}
      >
        {session.title}
      </Text>
      {
        /* A solid brand pill rather than red: the word carries the meaning,
         and it doesn't clash with the theme's accent color. */
      }
      {session.live && (
        <Text
          as="span"
          textStyle="xs"
          fontWeight="semibold"
          paddingInline="2"
          paddingBlock="0.5"
          borderRadius="full"
          bg="brand.800"
          color="brand.contrast"
          _dark={{ bg: "brand.solid" }}
          flexShrink="0"
        >
          Live
        </Text>
      )}
      {isSwitchingHere && (
        <Spinner size="xs" color="brand.fg" flexShrink="0" />
      )}
      {selected && (
        <Icon
          as={LuCheck}
          color="brand.800"
          _dark={{ color: "brand.300" }}
          flexShrink="0"
          aria-hidden
        />
      )}
    </>
  );

  const rowStyles = {
    display: "flex",
    alignItems: "center",
    gap: "3",
    minH: "11",
    paddingInline: "3",
    paddingBlock: "2",
    borderRadius: "l2",
  } as const;

  return selected
    ? (
      <chakra.div {...rowStyles} bg="highlight.selected" aria-current="page">
        {content}
      </chakra.div>
    )
    : (
      // A client-side navigation: the page resets itself for the new
      // session (see routes/QnA.tsx) without reloading the document.
      <chakra.a
        asChild
        {...rowStyles}
        color="fg"
        _hover={{ bg: "highlight.hover" }}
        focusVisibleRing="inside"
      >
        <Link to={qa(session.uid)}>{content}</Link>
      </chakra.a>
    );
}

function formatTime(start: Date | string) {
  return new Date(start).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
