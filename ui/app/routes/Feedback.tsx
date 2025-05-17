import { useState } from "react";
import { FiArrowLeft as ArrowBackIcon } from "react-icons/fi";
import { Field, Flex, Link as ChakraLink, Textarea } from "@chakra-ui/react";
import { Link as ReactRouterLink, useParams } from "react-router";
import { usePageTitle } from "../hooks/use-page-title.ts";
import { pageTitle } from "../utils/events.ts";
import { Header } from "../components/Header/Header.tsx";
import { useEvent } from "../hooks/use-event.ts";
import { useUser } from "../hooks/use-user.ts";
import { remote } from "../routing.js";
import { PrimaryButton } from "../components/Buttons/PrimaryButton.tsx";
import { useTicketProof } from "../hooks/use-ticket-proof.ts";
import { useZAPIConnect } from "../zapi/connect.ts";
import { useProvideFeedback } from "../hooks/use-provide-feedback.ts";
import { constructPODZapp } from "../zapi/zapps.ts";
import { collectionName } from "../zapi/collections.ts";
import { useZAPI } from "../zapi/context.tsx";
import { toaster } from "../components/ui/toaster.tsx";

export default function Feedback() {
  const { uid } = useParams();
  const { data: event } = useEvent(uid);
  usePageTitle(pageTitle(event));
  const { isAuthenticated } = useUser();
  const { connect, isConnecting } = useZAPIConnect();
  const [text, setText] = useState("");
  const context = useZAPI();
  const { login, isLoading: isLoggingIn } = useTicketProof({
    conferenceId: event?.conference.id,
    onError: (error) => {
      toaster.error({
        title: `Failed to login (${error?.message})`,
        description: error.message,
        duration: 2000,
      });
    },
  });

  const { provideFeedback, isLoading: isProvidingFeedback } =
    useProvideFeedback({
      onError: (error) => {
        toaster.error({
          title: "Submission Failed",
          description: error.message,
        });
      },
    });

  const handleSubmit = async () => {
    if (!event) {
      return;
    }

    const textValue = text.trim();

    if (!textValue) {
      return;
    }

    if (textValue.length > 1000) {
      toaster.error({
        title: "Submission Failed",
        description: "Note must be less than 1000 characters",
      });
      return;
    }

    let ticketProof: any; // ProveResult | undefined;
    if (!isAuthenticated) {
      ({ ticketProof } = await login());
    }

    const zapi = await connect(
      constructPODZapp(context?.config.zappName ?? "", [
        collectionName(context?.config.zappName ?? "", event.conference.name),
      ]),
    );
    let email: string | undefined;
    if (ticketProof) {
      email = ticketProof.revealedClaims.pods.ticket.entries.attendeeEmail
        ?.value as
          | string
          | undefined;
    }

    let name: string | undefined;
    if (ticketProof) {
      name = ticketProof.revealedClaims.pods.ticket.entries.attendeeName
        ?.value as
          | string
          | undefined;
    }

    await provideFeedback({ zapi, event, text: textValue, email, name });
    setText("");
    toaster.success({
      title: "Feedback Submitted",
      description: "Open Zupass to view.",
    });
  };

  return (
    <div className="layout">
      <header className="header">
        <nav>
          <ChakraLink asChild>
            <ReactRouterLink to={uid ? remote(uid) : ""}>
              <Flex
                flexDirection="row"
                gap="1"
                alignItems="center"
                padding="0.5rem 0 0 1rem"
                minHeight="1rem"
              >
                <ArrowBackIcon /> <span>Controls</span>
              </Flex>
            </ReactRouterLink>
          </ChakraLink>
        </nav>
        <div style={{ paddingBottom: "1rem" }}>
          <Header title={`Feedback: ${event?.title ?? "Loading..."}`} />
        </div>
      </header>
      <main className="content flex">
        <Flex flexDirection="column" gap="4" marginTop="2rem">
          <Field.Root>
            <Field.Label>Private Note</Field.Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              resize="vertical"
              size="lg"
              name="text"
              rows={4}
              placeholder="Type your note here..."
              maxLength={1000}
            />
            <Field.HelperText>
              Message will be signed with Zupass identity and delivered to all
              speakers of this event. Find your own feedback in Zupass.
            </Field.HelperText>
          </Field.Root>

          <PrimaryButton
            loading={isProvidingFeedback || isConnecting || isLoggingIn}
            loadingText="Loading..."
            onClick={handleSubmit}
            alignSelf="flex-end"
            disabled={!text.trim()}
          >
            Sign & Submit
          </PrimaryButton>
          <p style={{ marginTop: "auto", marginBottom: "1rem" }}>
            Are you a speaker? Check your feedback{" "}
            <ChakraLink asChild>
              <ReactRouterLink
                to="/speaker"
                style={{ textDecoration: "underline" }}
              >
                here
              </ReactRouterLink>
            </ChakraLink>
            .
          </p>
        </Flex>
      </main>
    </div>
  );
}
