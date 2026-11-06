import {
  Box,
  Button,
  Drawer,
  Flex,
  Link,
  List,
  Stack,
  Text,
} from "@chakra-ui/react";
import { FiGlobe, FiMessageSquare } from "react-icons/fi";
import { isPostHogEnabled, requestFeedback } from "../../lib/posthog.ts";
import { FaXTwitter } from "react-icons/fa6";
import { Link as ReactRouterLink } from "react-router";
import { Logo } from "../Logo.tsx";

/** Closes the drawer and opens PostHog's feedback survey. */
function GiveFeedback() {
  return (
    <List.Item>
      <Drawer.ActionTrigger asChild>
        <Button
          variant="plain"
          color="fg"
          fontWeight="normal"
          padding="2"
          height="auto"
          width="100%"
          justifyContent="start"
          onClick={requestFeedback}
        >
          <FiMessageSquare aria-hidden /> Give feedback
        </Button>
      </Drawer.ActionTrigger>
    </List.Item>
  );
}

const WEBSITE_URL = "https://meerkat.events";
const X_URL = "https://x.com/meerkat_events";

function ExternalLink(
  { href, children }: { href: string; children: React.ReactNode },
) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      display="inline-flex"
      alignItems="center"
      gap="1.5"
      color="inherit"
    >
      {children}
    </Link>
  );
}

function MeerkatLinks() {
  return (
    <Stack
      gap="3"
      width="100%"
      alignItems="center"
      textAlign="center"
      fontSize="sm"
      color="gray.500"
    >
      <Text>
        Hosting an event yourself? Check out{" "}
        <Link
          href={WEBSITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          color="inherit"
          textDecoration="underline"
        >
          meerkat.events
        </Link>{" "}
        for your own event.
      </Text>
      <Flex gap="4" justifyContent="center">
        <ExternalLink href={WEBSITE_URL}>
          <FiGlobe aria-hidden /> Website
        </ExternalLink>
        <ExternalLink href={X_URL}>
          <FaXTwitter aria-hidden /> @meerkat_events
        </ExternalLink>
      </Flex>
      <Link asChild color="inherit" textDecoration="underline">
        <ReactRouterLink to="/legal">Privacy policy and terms</ReactRouterLink>
      </Link>
    </Stack>
  );
}

interface NavigationDrawerContentProps {
  /** The Q&A page of the session the drawer is opened on. */
  questionsHref: string;
  /** Shown under the logo; the top bar shows the session title instead. */
  conferenceName?: string | undefined;
}

/**
 * What the drawer shows, in a chunk of its own. NavigationDrawer renders the
 * drawer around it, so focus moves into the drawer even before this arrives.
 */
export function NavigationDrawerContent(
  { questionsHref, conferenceName }: NavigationDrawerContentProps,
) {
  return (
    <>
      <Drawer.Header>
        <Flex
          direction="column"
          justifyContent="center"
          alignItems="center"
          gap="3"
          width="100%"
        >
          <Logo height="50px" width="auto" />
          {conferenceName && (
            <Drawer.Title textStyle="md" fontWeight="bold" textAlign="center">
              {conferenceName}
            </Drawer.Title>
          )}
        </Flex>
      </Drawer.Header>
      <Drawer.Body>
        <Box as="nav">
          <List.Root gap="3">
            <List.Item>
              <Link
                asChild
                padding="2"
                borderRadius="md"
                display="block"
              >
                <ReactRouterLink to={questionsHref}>
                  Questions
                </ReactRouterLink>
              </Link>
            </List.Item>
            {isPostHogEnabled() && <GiveFeedback />}
          </List.Root>
        </Box>
      </Drawer.Body>
      <Drawer.Footer>
        <MeerkatLinks />
      </Drawer.Footer>
    </>
  );
}
