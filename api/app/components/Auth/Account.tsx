import {
  Button,
  Flex,
  Menu,
  Portal,
  Text,
  useDisclosure,
  VStack,
} from "@chakra-ui/react";
import { FiChevronDown } from "react-icons/fi";
import { useState } from "react";
import { useLogout } from "../../hooks/use-logout.ts";
import { Link } from "react-router";
import { useModeratedEvents } from "../../hooks/use-moderated-events.ts";
import { useConferenceRoles } from "../../hooks/use-conference-roles.ts";
import type { User } from "../../hooks/use-auth.ts";
import { LogoutConfirmDialog } from "./LogoutConfirmDialog.tsx";
import { qa } from "../../routing.ts";
import { Logo } from "../Logo.tsx";

interface AccountProps {
  user: User;
}

export function Account({ user }: AccountProps) {
  const { logout } = useLogout();
  const { data: events, isLoading } = useModeratedEvents();
  const { data: roles } = useConferenceRoles();
  const isOrganizer = roles?.some((r) => r.role === "organizer") ?? false;
  const { open: isOpen, onOpen, onClose } = useDisclosure();
  const [selectedEventUid, setSelectedEventUid] = useState<string | undefined>(
    undefined,
  );

  const selectedEvent = events?.find((event) => event.uid === selectedEventUid);

  const handleJoinEvent = () => {
    if (selectedEventUid) {
      globalThis.open(qa(selectedEventUid), "_blank");
    }
  };

  return (
    <>
      <div className="layout">
        <header className="header">
          <Flex padding="0 1rem 0 1rem"></Flex>
        </header>
        <main className="content">
          <Flex
            flexDirection="column"
            alignItems="center"
            justifyContent="space-between"
            padding="2rem 1rem"
            height="100%"
          >
            <VStack gap="1.5rem" alignItems="center" width="100%">
              <Logo width="7.5rem" height="auto" />

              <Text fontSize="2xl" fontWeight="bold" textAlign="center">
                You are logged in
              </Text>

              <Text fontSize="md" textAlign="center">
                {user.email}
              </Text>

              {isOrganizer && (
                <Button asChild colorPalette="brand">
                  <Link to="/manage">Open Meerkat Management</Link>
                </Button>
              )}

              {isLoading
                ? <Text color="gray.400">Loading events...</Text>
                : events && events.length > 0
                ? (
                  <VStack gap="1rem" width="100%" maxWidth="20rem">
                    <Menu.Root positioning={{ placement: "bottom" }}>
                      <Menu.Trigger asChild>
                        <Button
                          width="100%"
                          variant="outline"
                          justifyContent="space-between"
                          colorPalette="gray"
                        >
                          {selectedEvent?.title || "Select event"}
                          <FiChevronDown />
                        </Button>
                      </Menu.Trigger>
                      <Portal>
                        <Menu.Positioner>
                          <Menu.Content width="var(--reference-width)">
                            {events.map((event) => (
                              <Menu.Item
                                key={event.uid}
                                value={event.uid}
                                onClick={() => setSelectedEventUid(event.uid)}
                              >
                                {event.title}
                              </Menu.Item>
                            ))}
                          </Menu.Content>
                        </Menu.Positioner>
                      </Portal>
                    </Menu.Root>

                    <Button
                      width="100%"
                      colorPalette="purple"
                      disabled={!selectedEventUid}
                      onClick={handleJoinEvent}
                    >
                      Join event
                    </Button>
                  </VStack>
                )
                : (
                  <Text color="gray.400" textAlign="center">
                    No organizer events available
                  </Text>
                )}
            </VStack>

            <VStack gap="1rem" alignItems="center" width="100%">
              <Text
                as="button"
                onClick={onOpen}
                fontSize="md"
                textDecoration="underline"
                cursor="pointer"
                _hover={{ opacity: 0.8 }}
              >
                Log out
              </Text>

              <VStack gap="0.25rem" alignItems="center">
                <Text fontSize="sm" color="gray.500">
                  Signed in as {user.user_metadata?.["name"] || "anonymous"}
                </Text>
                <Text fontSize="xs" color="gray.600">
                  {user.id}
                </Text>
              </VStack>
            </VStack>
          </Flex>
        </main>
      </div>
      <LogoutConfirmDialog
        isOpen={isOpen}
        onClose={onClose}
        onConfirm={logout}
      />
    </>
  );
}
