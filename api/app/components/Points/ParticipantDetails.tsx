import {
  Box,
  Button,
  CloseButton,
  Dialog,
  Flex,
  Portal,
  Spinner,
  Text,
  VisuallyHidden,
} from "@chakra-ui/react";
import { useRef } from "react";
import { tapTargetStyles } from "../../theme/index.ts";
import { MeerkatMascot } from "../QnA/MeerkatMascot.tsx";
import { useParticipant } from "../../hooks/use-participant.ts";
import type { Participant, PointsScoring } from "../../types.ts";
import { tierLabel, tierPaletteStyle } from "./tier.ts";
import "../QnA/Supervote.css";

export type ParticipantDetailsProps = {
  conferenceId: number | undefined;
  /** The participant to show; the dialog is closed while undefined. */
  selected: { userId: string; name: string; isMe: boolean } | undefined;
  onClose: () => void;
  /** Offered on the user's own profile. */
  onLogout?: (() => void) | undefined;
};

const plural = (count: number, singular: string, plural: string) =>
  `${count} ${count === 1 ? singular : plural}`;

/**
 * Someone's points at the conference and their percentile tier, opened from
 * their name on a question. Their points are fetched only while it's open.
 */
export function ParticipantDetails(
  { conferenceId, selected, onClose, onLogout }: ParticipantDetailsProps,
) {
  // Focus starts on Close rather than the first button, which on the user's
  // own profile would be Log out
  const closeRef = useRef<HTMLButtonElement>(null);
  // The same request as in Details (SWR shares it), for the tier's colors on
  // the whole card
  const { data } = useParticipant(conferenceId, selected?.userId);
  const tier = data?.tier ?? null;

  return (
    <Dialog.Root
      placement="center"
      motionPreset="scale"
      size="xs"
      open={!!selected}
      onOpenChange={(details) => !details.open && onClose()}
      initialFocusEl={() => closeRef.current}
      lazyMount
      unmountOnExit
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner padding="4">
          <Dialog.Content
            textAlign="center"
            paddingTop="6"
            style={tier !== null ? tierPaletteStyle(tier) : undefined}
          >
            {selected && (
              <Details conferenceId={conferenceId} {...selected} />
            )}
            {selected?.isMe && onLogout && (
              <Dialog.Footer paddingTop="0">
                <Button
                  variant="outline"
                  width="full"
                  borderRadius="full"
                  onClick={onLogout}
                  {...tapTargetStyles}
                >
                  Log out
                </Button>
              </Dialog.Footer>
            )}
            <Dialog.CloseTrigger asChild>
              <CloseButton ref={closeRef} size="sm" color="fg.muted" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

function Details(
  { conferenceId, userId, name, isMe }:
    & { conferenceId: number | undefined }
    & NonNullable<ParticipantDetailsProps["selected"]>,
) {
  const { data, scoring, error, isLoading } = useParticipant(
    conferenceId,
    userId,
  );
  const tier = data?.tier ?? null;

  return (
    <>
      <div
        className="supervote-info-medal"
        aria-hidden="true"
        // In the tier's accent, like the tier pill below (purple without one)
        style={tier !== null
          ? {
            backgroundColor: "var(--tier-accent)",
            borderColor: "var(--tier-ring)",
          }
          : undefined}
      >
        <MeerkatMascot className="supervote-info-meerkat" />
      </div>
      <Dialog.Header
        flexDirection="column"
        alignItems="center"
        gap="1"
        paddingBottom="2"
      >
        {/* Wraps however long the name, so enlarged text still shows it */}
        <Dialog.Title textStyle="lg" overflowWrap="anywhere">
          {name}
          {isMe && (
            <Text as="span" color="fg.muted" fontWeight="normal">
              {" "}(you)
            </Text>
          )}
        </Dialog.Title>
        {tier !== null && data && (
          <Dialog.Description textStyle="sm" color="fg.muted">
            <Text
              as="span"
              display="inline-block"
              marginBottom="1"
              paddingX="2.5"
              paddingY="0.5"
              borderRadius="full"
              bg="var(--tier-accent)"
              color="var(--tier-accent-fg)"
              // Inset, so a ringed pill is no bigger than the others
              boxShadow="inset 0 0 0 1.5px var(--tier-pill-ring)"
              textStyle="xs"
              fontWeight="bold"
              textTransform="uppercase"
              letterSpacing="wider"
            >
              {tierLabel(tier)}
            </Text>
            <br />
            of {plural(data.contributors, "person", "people")}{" "}
            asking and voting here
          </Dialog.Description>
        )}
      </Dialog.Header>
      <Dialog.Body paddingBottom="6">
        {isLoading
          ? (
            <Box role="status">
              <Spinner color="fg.muted" aria-hidden="true" />
              <VisuallyHidden>Loading points…</VisuallyHidden>
            </Box>
          )
          : error?.status === 404
          ? (
            // Hasn't asked or voted at this conference yet
            <Text textStyle="sm" color="fg.muted">
              No points yet. Points come from votes on{" "}
              {isMe ? "your" : "their"} questions and from questions picked
              for the stage.
            </Text>
          )
          : error || !data
          ? (
            <Text textStyle="sm" color="fg.muted">
              Couldn't load {isMe ? "your" : "their"} points.
            </Text>
          )
          : <PointsBreakdown participant={data} scoring={scoring} />}
      </Dialog.Body>
    </>
  );
}

function PointsBreakdown(
  { participant, scoring }: {
    participant: Participant;
    scoring: PointsScoring | undefined;
  },
) {
  const lines = [
    {
      label: plural(participant.picked, "question picked", "questions picked"),
      points: participant.picked * (scoring?.picked ?? 0),
    },
    {
      label: plural(participant.votesReceived, "vote received", "votes received"),
      points: participant.votesReceived * (scoring?.vote ?? 0),
    },
  ];

  return (
    <Box textAlign="start">
      {/* Outlined rather than filled: muted text keeps 4.5:1 contrast only on
          the dialog's own background */}
      <Box
        as="dl"
        borderRadius="lg"
        borderWidth="1px"
        borderColor="border"
        paddingX="4"
        paddingY="1"
      >
        {lines.map(({ label, points }) => (
          <Flex
            key={label}
            // Zero lines stay, as a hint of how to earn points, but muted
            color={points ? "fg" : "fg.muted"}
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
        <Text>{plural(participant.points, "pt", "pts")}</Text>
      </Flex>
    </Box>
  );
}
