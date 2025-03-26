import { useState } from "react";
import { Button, Flex, Heading, Skeleton, Stack } from "@chakra-ui/react";
import { Link, useParams } from "react-router";
import { PrimaryButton } from "../components/Buttons/PrimaryButton.tsx";
import { useEvent } from "../hooks/use-event.ts";
import { card, feedback, qa } from "../routing.ts";
import { ExternalLinkIcon } from "@chakra-ui/icons";
import { usePageTitle } from "../hooks/use-page-title.ts";
import { pageTitle } from "../utils/events.ts";

export default function Remote() {
  const { uid } = useParams();
  const { data: event } = useEvent(uid);
  const [isLoading, setIsLoading] = useState(true);

  usePageTitle(pageTitle(event));

  const hasFileverseLink = event?.features["fileverse-link"] ?? false;
  const hasSpeakerFeedback = event?.features["speaker-feedback"] ?? false;

  return (
    <div className="layout">
      <main
        className="content"
        style={{
          marginTop: "6dvh",
          marginBottom: "1dvh",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          textAlign: "center",
          alignItems: "center",
        }}
      >
        <Skeleton
          isLoaded={!isLoading}
          minWidth={240}
          minHeight={240}
          rounded="12px"
          display="flex"
          justifyContent="center"
          alignItems="center"
        >
          {event?.conference.logoUrl
            ? (
              <img
                style={{
                  height: "auto",
                  width: "100%",
                  maxWidth: 300,
                  maxHeight: 300,
                  margin: "0 auto",
                }}
                src={event.conference.logoUrl}
                alt={event.conference.name}
                onLoad={() => setIsLoading(false)}
              />
            )
            : null}
        </Skeleton>
        <Stack spacing={2} flexDirection="column" alignItems="center">
          <Skeleton isLoaded={!!event} width="fit-content">
            <Heading as="h1" color="white" size="lg" mb={1.5}>
              {event?.title ?? "Loading... please stand by"}
            </Heading>
          </Skeleton>
          <Flex justifyContent="space-between">
            <Skeleton isLoaded={!!event} width="fit-content">
              <Heading
                as="h2"
                size="md"
                fontWeight="thin"
                wordBreak="break-word"
                color="white"
              >
                {event?.speaker ?? "Loading..."}
              </Heading>
            </Skeleton>
          </Flex>
        </Stack>
        <Stack spacing={4} flexDirection="column" alignItems="center">
          <PrimaryButton as={Link} to={uid ? qa(uid) : ""}>
            Join Q&A
          </PrimaryButton>
          <Button
            variant="outline"
            as={Link}
            to={uid ? card(uid) : ""}
            width="16rem"
            fontWeight="bold"
            py={6}
          >
            Collect Card
          </Button>
          {hasSpeakerFeedback && (
            <Button
              variant="outline"
              as={Link}
              to={uid ? feedback(uid) : ""}
              width="16rem"
              fontWeight="bold"
              py={6}
            >
              Speaker Feedback
            </Button>
          )}
          {hasFileverseLink && event?.uid && (
            <Link
              to={`https://devcon.fileverse.io/devcon7/portal?event=${event.uid}`}
              target="_blank"
            >
              Contribute on Fileverse <ExternalLinkIcon />
            </Link>
          )}
        </Stack>
      </main>
    </div>
  );
}
