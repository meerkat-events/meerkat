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
  Text,
  VisuallyHidden,
} from "@chakra-ui/react";
import { qa } from "../../routing.ts";

export type SessionItem = {
  uid: string;
  title: string;
  selected: boolean;
  live: boolean;
  start: Date | string;
};

interface SessionSwitcherProps {
  title: string | undefined;
  stage: string | undefined;
  past: SessionItem[];
  live: SessionItem[];
  upcoming: SessionItem[];
}

/**
 * The session title; tapping it opens a modal listing the sessions on the
 * same stage, with times and live status.
 */
export function SessionSwitcher(
  { title, stage, past, live, upcoming }: SessionSwitcherProps,
) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div className="title-section">
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
          size="lg"
          mb={2}
          textAlign="center"
          // The theme's body font (Roboto on Devconnect) rather than its
          // condensed heading font, matching the conference name above.
          fontFamily="body"
        >
          <Dialog.Trigger asChild>
            <chakra.button
              type="button"
              display="inline-flex"
              alignItems="center"
              gap="1"
              maxW="full"
              textAlign="start"
              cursor="pointer"
              borderRadius="l1"
              focusVisibleRing="outside"
            >
              {/* One line: long titles truncate, the chevron stays visible */}
              <chakra.span minW="0" truncate>
                {title ?? "Loading..."}
              </chakra.span>
              <Icon as={FiChevronDown} color="brand.fg" flexShrink="0" />
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
                      <SessionGroup label="Past" sessions={past} />
                      <SessionGroup label="Live" sessions={live} />
                      <SessionGroup label="Next" sessions={upcoming} />
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
    </div>
  );
}

function SessionGroup(
  { label, sessions }: { label: string; sessions: SessionItem[] },
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
            <SessionRow session={session} />
          </li>
        ))}
      </Box>
    </Box>
  );
}

function SessionRow({ session }: { session: SessionItem }) {
  const content = (
    <>
      <Text
        as="span"
        textStyle="xs"
        color="fg.muted"
        minW="10"
        fontVariantNumeric="tabular-nums"
      >
        {formatTime(session.start)}
      </Text>
      <Text
        as="span"
        flex="1"
        textStyle="sm"
        fontWeight={session.selected ? "semibold" : "normal"}
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
      {session.selected && (
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

  return session.selected
    ? (
      <chakra.div {...rowStyles} bg="brand.solid/10" aria-current="page">
        {content}
      </chakra.div>
    )
    : (
      <chakra.a
        {...rowStyles}
        href={qa(session.uid)}
        color="fg"
        _hover={{ bg: "bg.muted" }}
        focusVisibleRing="inside"
      >
        {content}
      </chakra.a>
    );
}

function formatTime(start: Date | string) {
  return new Date(start).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
