import { Button, Flex, Input, Text } from "@chakra-ui/react";
import { FormEvent, useState } from "react";
import { useOTP } from "../../hooks/use-otp.ts";

export function LoginForm() {
  const { signUp, verify, isLoading, error } = useOTP();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;

    const result = await signUp(email);
    if (result) {
      setEmailSubmitted(true);
    }
  };

  const handleOtpSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!otp) return;

    await verify(email, otp);
  };

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
                  ? "Enter the code we sent to your email"
                  : "Enter your email to receive a login code"}
              </Text>
            </Flex>

            <form
              onSubmit={emailSubmitted ? handleOtpSubmit : handleEmailSubmit}
            >
              <Flex flexDirection="column" gap="16px">
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  readOnly={emailSubmitted}
                  disabled={isLoading}
                  size="lg"
                />

                {emailSubmitted && (
                  <Input
                    type="text"
                    placeholder="Enter OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    disabled={isLoading}
                    size="lg"
                    autoFocus
                  />
                )}

                <Button type="submit" loading={isLoading} size="lg">
                  {emailSubmitted ? "Verify Code" : "Send Code"}
                </Button>

                {error && (
                  <Text color="red.500" fontSize="sm" textAlign="center">
                    {error}
                  </Text>
                )}
              </Flex>
            </form>
          </Flex>
        </Flex>
      </main>
    </div>
  );
}
