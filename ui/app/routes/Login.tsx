import { ExternalLinkIcon } from "@chakra-ui/icons";
import { PrimaryButton } from "../components/Buttons/PrimaryButton.tsx";
import { useLogin } from "../hooks/use-login.ts";
import { useUser } from "../hooks/use-user.ts";

export default function Login() {
  const { login, isLoading } = useLogin();
  const { data: user, isAuthenticated } = useUser();

  return (
    <>
      {isAuthenticated ? <p>Logged in as {user?.uid}</p> : (
        <PrimaryButton
          isLoading={isLoading}
          loadingText="Connecting..."
          onClick={() => login()}
        >
          Login with Zupass <ExternalLinkIcon />
        </PrimaryButton>
      )}
    </>
  );
}
