import {
  Box,
  Button,
  CloseButton,
  Dialog,
  Flex,
  Portal,
  Spinner,
  Text,
} from "@chakra-ui/react";
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
  return (
    <Dialog.Root
      placement="center"
      motionPreset="scale"
      size="xs"
      open={!!selected}
      onOpenChange={(details) => !details.open && onClose()}
      lazyMount
      unmountOnExit
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner padding="4">
          <Dialog.Content textAlign="center" paddingTop="6">
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
                >
                  Log out
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
    <Box style={tier !== null ? tierPaletteStyle(tier) : undefined}>
      <div className="supervote-info-medal" aria-hidden="true">
        <MeerkatMascot className="supervote-info-meerkat" />
      </div>
      <Dialog.Header
        flexDirection="column"
        alignItems="center"
        gap="1"
        paddingBottom="2"
      >
        <Dialog.Title textStyle="lg" lineClamp={2}>
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
              bg="colorPalette.subtle"
              color="colorPalette.fg"
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
          ? <Spinner color="fg.muted" />
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
    </Box>
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
      <Box as="dl" borderRadius="lg" bg="bg.muted" paddingX="4" paddingY="1">
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
        <Text>{plural(participant.points, "pt", "pts")}</Text>
      </Flex>
    </Box>
  );
}
