import { ExternalLinkIcon } from "@chakra-ui/icons";
import {
  Flex,
  Icon,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  useToast,
} from "@chakra-ui/react";
import { useAsyncFormSubmit } from "../../hooks/use-async-form-submit.ts";
import { Event } from "../../hooks/use-event.ts";
import { useLogin } from "../../hooks/use-login.ts";
import { useThemeColors } from "../../hooks/use-theme-colors.ts";
import { User } from "../../types.ts";
import { PrimaryButton } from "../Buttons/PrimaryButton.tsx";
import { HeartIcon } from "./HeartIcon.tsx";

const MAX_QUESTION_LENGTH = 200;

export type FooterProps = {
  event: Event | undefined;
  isAuthenticated: boolean;
  user: User | undefined;
  refresh: () => void;
  onReactClick: () => void;
};

export function Footer({
  event,
  isAuthenticated,
  user,
  refresh,
  onReactClick,
}: FooterProps) {
  const { primaryPurple } = useThemeColors();
  const { login, isLoading } = useLogin();
  const toast = useToast();
  const { onSubmit } = useAsyncFormSubmit({
    onSuccess: () => {
      toast({
        title: "Question added 🎉",
        status: "success",
        duration: 2000,
      });
      refresh();
    },
  });

  const action = `/api/v1/events/${event?.uid}/questions`;

  return (
    <>
      <div className="overlay-container">
        <form
          className="target question-input"
          onSubmit={onSubmit}
          method="POST"
          action={action}
        >
          <Flex gap={2} flexFlow="row" alignItems="center">
            <InputGroup size="lg">
              <Input
                size="lg"
                disabled={!isAuthenticated}
                placeholder={!isAuthenticated
                  ? "Please, login before submitting a question!"
                  : "Type a question..."}
                name="question"
                bg="#342749"
                color="white"
                borderColor={primaryPurple}
                border="none"
                borderRadius="md"
                p="4 4 10 4"
                _placeholder={{ color: "white" }}
                maxLength={MAX_QUESTION_LENGTH}
              />
              <InputRightElement width="auto" pr={2}>
                <IconButton
                  isDisabled={!isAuthenticated}
                  type="submit"
                  h="1.75rem"
                  size="sm"
                  colorScheme="purple"
                  icon={<SendIcon />}
                  _hover={isAuthenticated
                    ? {
                      bg: primaryPurple,
                      color: "white",
                      opacity: 0.8,
                    }
                    : {}}
                  aria-label="Submit question"
                />
              </InputRightElement>
            </InputGroup>
            <IconButton
              isDisabled={!isAuthenticated}
              onClick={onReactClick}
              size="lg"
              colorScheme="purple"
              bg="#342749"
              icon={<HeartIcon />}
              _hover={isAuthenticated
                ? {
                  bg: primaryPurple,
                  color: "white",
                  opacity: 0.8,
                }
                : {}}
              aria-label="React to event"
              type="button"
            />
          </Flex>
          <span className="signin-name">
            Signed as {user?.name ?? user?.uid ?? "Anonymous"}
          </span>
        </form>
        {!isAuthenticated && (
          <LoginOverlay>
            <PrimaryButton
              isLoading={isLoading}
              loadingText="Connecting..."
              onClick={() => login()}
            >
              Login with Zupass <ExternalLinkIcon />
            </PrimaryButton>
          </LoginOverlay>
        )}
      </div>
    </>
  );
}

function LoginOverlay(
  { children }: { children?: React.ReactNode },
) {
  return (
    <div className="overlay login">
      <span>To participate:</span>
      {children}
    </div>
  );
}

function SendIcon() {
  return (
    <Icon viewBox="0 0 24 24">
      <path fill="white" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </Icon>
  );
}
