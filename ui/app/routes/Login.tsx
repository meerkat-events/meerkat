import { ExternalLinkIcon } from "@chakra-ui/icons";
import { PrimaryButton } from "../components/Buttons/PrimaryButton.tsx";
import { useLogin } from "../hooks/use-login.ts";
import { useUser } from "../hooks/use-user.ts";
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
  Heading,
  Link as ChakraLink,
  useDisclosure,
} from "@chakra-ui/react";
import { useRef } from "react";
import { useLogout } from "../hooks/use-logout.ts";

export default function Login() {
  const { login, isLoading } = useLogin();
  const { trigger: logout } = useLogout();
  const { data: user, isAuthenticated } = useUser();

  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const onLogout = async () => {
    await logout({});
    globalThis.location.reload();
  };

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        alignItems: "center",
        padding: "1rem",
        height: "100vh",
      }}
    >
      <Heading as="h1">Login</Heading>

      {isAuthenticated
        ? (
          <p>
            Signed in as{" "}
            <ChakraLink onClick={onOpen}>
              {user?.name ?? user?.uid ?? "Anonymous"}
            </ChakraLink>
          </p>
        )
        : (
          <PrimaryButton
            isLoading={isLoading}
            loadingText="Connecting..."
            onClick={() => login()}
          >
            Login with Zupass <ExternalLinkIcon />
          </PrimaryButton>
        )}
      <AlertDialog
        isOpen={isOpen}
        leastDestructiveRef={cancelRef}
        onClose={onClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Logout
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to logout?
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} colorScheme="gray" onClick={onClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={onLogout} ml={3}>
                Logout
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </main>
  );
}
