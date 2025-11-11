import { useState } from "react";
import { Flex, Link as ChakraLink } from "@chakra-ui/react";
import { useParams } from "react-router";
import Card from "../components/Card/Card.tsx";
import { useEvent } from "../hooks/use-event.ts";
import { Header } from "../components/Header/Header.tsx";
import { FiArrowUpRight as ExternalLinkIcon } from "react-icons/fi";
import { useCollect } from "../hooks/use-collect.ts";
import { pageTitle } from "../utils/events.ts";
import { useDocumentTitle } from "@uidotdev/usehooks";
import { PrimaryButton } from "../components/Buttons/PrimaryButton.tsx";
import { useZupassPods } from "../hooks/use-zupass-pods.ts";
import { useZAPIConnect } from "../zapi/connect.ts";
import { useZAPI } from "../zapi/context.tsx";
import { attendancePodType } from "../utils/pod.client.ts";
import { constructZapp } from "../zapi/zapps.ts";
import { collectionName } from "../zapi/collections.ts";
import { isError } from "../utils/error.ts";
import { toaster } from "../components/ui/toaster.tsx";
import { getConferenceTickets } from "~/hooks/use-conference-tickets.ts";
import { useLinks } from "~/components/NavigationDrawer/use-links.ts";
import { NavigationDrawer } from "~/components/NavigationDrawer/index.tsx";

export default function EventCard() {
  const { uid } = useParams();
  const { data: event } = useEvent(uid);
  const [isCollected, setIsCollected] = useState(false);
  useDocumentTitle(pageTitle(event));
  const [isCollecting, setIsCollecting] = useState(false);
  const { connect } = useZAPIConnect();
  const context = useZAPI();
  const { collect } = useCollect(event);
  const { getZupassPods } = useZupassPods();

  const onCollect = async () => {
    if (!event?.conference) {
      return;
    }
    setIsCollecting(true);
    try {
      const collection = collectionName(
        context?.config.zappName ?? "",
        event?.conference.name,
      );
      const tickets = await getConferenceTickets(event?.conferenceId);
      const ticketCollectionsSet = new Set(
        tickets.map((ticket) => ticket.collectionName),
      );
      const ticketCollections = Array.from(ticketCollectionsSet);

      const zapi = await connect(
        constructZapp(
          context?.config.zappName ?? "",
          [collection],
          ticketCollections,
        ),
      );
      const pods = await getZupassPods(
        zapi,
        collection,
        attendancePodType,
      );
      const hasEventPods = pods.some((p) =>
        p.entries.code.value === event?.uid
      );

      if (hasEventPods) {
        toaster.create({
          title: "Attendance Already Recorded",
          description: "Open Zupass to view your attendance POD",
          type: "info",
          duration: 5000,
          closable: true,
        });
      } else {
        await collect(zapi);
        toaster.create({
          title: "Attendance Recorded",
          description: "Open Zupass to view your attendance POD",
          type: "success",
          duration: 5000,
          closable: true,
        });
      }
      setIsCollected(true);
    } catch (error) {
      toaster.create({
        title: "Error: Failed to record attendance",
        description: `Please try again later. Error: ${
          isError(error) ? error.message : "Unknown error"
        }`,
        type: "error",
        duration: 9000,
        closable: true,
      });
    } finally {
      setIsCollecting(false);
    }
  };

  const action = !isCollected ? onCollect : null;

  const navLinks = useLinks({ event });

  return (
    <div className="layout">
      <header className="header">
        <Flex padding="0 1rem 0 1rem">
          <nav>
            <NavigationDrawer navLinks={navLinks} />
            {event?.conference.name}
          </nav>
        </Flex>
        <div style={{ paddingBottom: "1rem" }}>
          <Header title={`Card: ${event?.title ?? "Loading..."}`} />
        </div>
      </header>
      <main className="content">
        <Flex
          flexDirection="column"
          alignItems="center"
          gap="12px"
          textAlign="center"
          padding="1rem 0"
          height="100%"
        >
          <Card event={event} />
          {action
            ? (
              <PrimaryButton
                loading={isCollecting}
                loadingText="Collecting..."
                onClick={action}
                disabled={isCollecting}
              >
                Collect
              </PrimaryButton>
            )
            : isCollected
            ? (
              <p>
                <ChakraLink
                  href="https://zupass.org"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Zupass <ExternalLinkIcon />
                </ChakraLink>{" "}
                to view your attendance PODs.
              </p>
            )
            : null}
        </Flex>
      </main>
    </div>
  );
}
