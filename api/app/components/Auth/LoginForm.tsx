import { Button, Flex, Input, Text } from "@chakra-ui/react";
import { useState } from "react";
import { useOTP } from "../../hooks/use-otp.ts";

/**
 * Supabase redirects a used or expired sign-in link back here with the reason
 * in the URL fragment (`#error_description=…`).
 */
function readLinkError() {
  const fragment = new URLSearchParams(globalThis.location.hash.slice(1));
  return fragment.get("error_description");
}

export function LoginForm({ next }: { next: string | undefined }) {
  const { sendLink, isLoading, error } = useOTP();
  const [email, setEmail] = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [linkError] = useState(readLinkError);

  const handleEmailSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email) return;

    const result = await sendLink(email, next);
    if (result) {
      setEmailSubmitted(true);
    }
  };

  const shownError = error ?? (emailSubmitted ? null : linkError);

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
          padding="2rem 1rem"
          height="100%"
        >
          <Flex
            flexDirection="column"
            gap="24px"
            width="100%"
            maxWidth="400px"
          >
            <Flex flexDirection="column" gap="8px" textAlign="center">
              <Text fontSize="2xl" fontWeight="bold">
                {emailSubmitted ? "Check Your Email" : "Sign In"}
              </Text>
              <Text color="gray.400" fontSize="sm">
                {emailSubmitted
                  ? `Open the link we sent to ${email} on the device you want to sign in on.`
                  : "Enter your email to receive a sign-in link"}
              </Text>
            </Flex>

            {!emailSubmitted && (
              <form onSubmit={handleEmailSubmit}>
                <Flex flexDirection="column" gap="16px">
                  <Input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    size="lg"
                  />

                  <Button type="submit" loading={isLoading} size="lg">
                    Send Link
                  </Button>
                </Flex>
              </form>
            )}

            {shownError && (
              <Text color="red.500" fontSize="sm" textAlign="center">
                {shownError}
              </Text>
            )}
          </Flex>
        </Flex>
      </main>
    </div>
  );
}
