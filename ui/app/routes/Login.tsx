import { FiArrowUpRight as ExternalLinkIcon } from "react-icons/fi";
import { PrimaryButton } from "../components/Buttons/PrimaryButton.tsx";
import { useLogin } from "../hooks/use-login.ts";
import { useUser } from "../hooks/use-user.ts";
import {
  Button,
  CloseButton,
  Dialog,
  Heading,
  Link as ChakraLink,
  useDisclosure,
} from "@chakra-ui/react";
import { useLogout } from "../hooks/use-logout.ts";

export default function Login() {
  const { login, isLoading } = useLogin();
  const { trigger: logout } = useLogout();
  const { data: user, isAuthenticated } = useUser();

  const { open, onOpen, onClose } = useDisclosure();

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
            loading={isLoading}
            loadingText="Connecting..."
            onClick={() => login()}
          >
            Login with Zupass <ExternalLinkIcon />
          </PrimaryButton>
        )}
      <Dialog.Root
        role="alertdialog"
        open={open}
        onOpenChange={onClose}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>
                Logout
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              Are you sure you want to logout?
            </Dialog.Body>
            <Dialog.Footer>
              <Button colorPalette="red" onClick={onLogout}>Logout</Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </main>
  );
}
