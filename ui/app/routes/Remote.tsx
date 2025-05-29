import { Button, Flex, Heading, Skeleton } from "@chakra-ui/react";
import { Link, useParams } from "react-router";
import { useState } from "react";
import { PrimaryButton } from "../components/Buttons/PrimaryButton.tsx";
import { useEvent } from "../hooks/use-event.ts";
import { card, feedback, qa } from "../routing.ts";
import { usePageTitle } from "../hooks/use-page-title.ts";
import { pageTitle } from "../utils/events.ts";

export default function Remote() {
  const { uid } = useParams();
  const { data: event, isLoading: isEventLoading } = useEvent(uid);
  const [isLoading, setIsLoading] = useState(true);

  usePageTitle(pageTitle(event));

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
          loading={isLoading}
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
        <Flex gap={2} alignItems="center" direction="column">
          <Skeleton loading={!event} width="fit-content">
            <Heading as="h1" color="white" fontWeight="bold" size="2xl">
              {isEventLoading ? "Loading..." : event?.title}
            </Heading>
          </Skeleton>
          <Flex justifyContent="space-between">
            <Skeleton loading={!event} width="fit-content">
              <Heading
                as="h2"
                size="lg"
                fontWeight="200"
                wordBreak="break-word"
                color="white"
              >
                {isEventLoading ? "Loading..." : event?.speaker}
              </Heading>
            </Skeleton>
          </Flex>
        </Flex>
        <Flex
          gap={3}
          direction="column"
          alignItems="stretch"
          maxW="280px"
          w="100%"
        >
          <PrimaryButton as={Link} to={uid ? qa(uid) : ""}>
            Join Q&A
          </PrimaryButton>
          <Button
            asChild
            variant="outline"
            size="lg"
          >
            <Link to={uid ? card(uid) : ""}>
              Collect Card
            </Link>
          </Button>
          {hasSpeakerFeedback && (
            <Button
              asChild
              variant="outline"
              size="lg"
            >
              <Link to={uid ? feedback(uid) : ""}>
                Speaker Feedback
              </Link>
            </Button>
          )}
        </Flex>
      </main>
    </div>
  );
}
