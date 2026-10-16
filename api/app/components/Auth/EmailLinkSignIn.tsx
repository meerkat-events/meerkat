import { Button, Flex, Text } from "@chakra-ui/react";
import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { useOTP } from "../../hooks/use-otp.ts";
import { LoadingState } from "./LoadingState.tsx";

/**
 * Signs in from the link in the sign-in email (`/login?token_hash=…`), then
 * drops the token from the URL so the login page sends the user on as after
 * entering the code.
 */
export function EmailLinkSignIn({ tokenHash }: { tokenHash: string }) {
  const { verifyLink, error } = useOTP();
  const [, setParams] = useSearchParams();
  const verifying = useRef(false);

  useEffect(() => {
    // The token works once: verify on the first run only, not again on
    // re-renders or in React's dev double effect.
    if (verifying.current) return;
    verifying.current = true;

    verifyLink(tokenHash).then((session) => {
      if (session) {
        setParams({}, { replace: true });
      }
    });
  }, [tokenHash, verifyLink, setParams]);

  if (!error) {
    return <LoadingState />;
  }

  return (
    <div className="layout">
      <header className="header">
        <Flex padding="0 1rem 0 1rem"></Flex>
      </header>
      <main className="content">
        <Flex
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          gap="16px"
          padding="2rem 1rem"
          height="100%"
          textAlign="center"
        >
          <Text fontSize="2xl" fontWeight="bold">
            Sign-in link didn’t work
          </Text>
          <Text color="gray.400" fontSize="sm" maxWidth="400px">
            It may have expired or been used already. Request a new code to
            sign in.
          </Text>
          <Button size="lg" onClick={() => setParams({}, { replace: true })}>
            Sign In
          </Button>
        </Flex>
      </main>
    </div>
  );
}
