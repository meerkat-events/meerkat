import { useRef } from "react";
import { ExternalLinkIcon } from "@chakra-ui/icons";
import {
  Button,
  Flex,
  Icon,
  IconButton,
  Link as ChakraLink,
  Textarea,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { Link } from "react-router";
import { useLocalStorage } from "@uidotdev/usehooks";
import { useTicketProof } from "../../hooks/use-ticket-proof.ts";
import { useThemeColors } from "../../hooks/use-theme-colors.ts";
import type { Event, User } from "../../types.ts";
import { PrimaryButton } from "../Buttons/PrimaryButton.tsx";
import { HeartIcon } from "./HeartIcon.tsx";
import { useState } from "react";
import { useAskQuestion } from "../../hooks/use-ask-question.ts";
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
} from "@chakra-ui/react";
import { useLogout } from "../../hooks/use-logout.ts";

import "./Footer.css";
import { useLogin } from "../../hooks/use-login.ts";

const MAX_QUESTION_LENGTH = 200;

export type FooterProps = {
  event: Event | undefined;
  isAuthenticated: boolean;
  isUserLoading: boolean;
  user: User | undefined;
  refresh: () => void;
  onReactClick: () => void;
};

export function Footer({
  event,
  isAuthenticated,
  isUserLoading,
  user,
  refresh,
  onReactClick,
}: FooterProps) {
  const { primaryPurple } = useThemeColors();
  const [focused, setFocused] = useState(false);
  const toast = useToast();

  const hasZupassLogin = event?.features["zupass-login"] ?? false;

  const { login, isLoading } = hasZupassLogin
    ? useLogin({
      conferenceId: event?.id,
      onError: (error) => {
        toast({
          title: `Failed to login`,
          status: "error",
          description: error.message,
          duration: 2000,
        });
      },
    })
    : useTicketProof({
      conferenceId: event?.id,
      onError: (error) => {
        toast({
          title: `Failed to login`,
          status: "error",
          description: error.message,
          duration: 2000,
        });
      },
    });
  const [question, setQuestion] = useState("");
  const [isTutorialHeartFinished, setIsTutorialHeartFinished] = useLocalStorage(
    "tutorial-heart",
    false,
  );

  const { trigger } = useAskQuestion(event, {
    onSuccess: () => {
      toast({
        title: "Question added 🎉",
        status: "success",
        duration: 2000,
      });
      refresh();
      setQuestion("");
    },
    onError: (error) => {
      toast({
        title: `Failed to create question`,
        status: "error",
        description: error.message,
        duration: 2000,
      });
    },
  });

  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const { trigger: logout } = useLogout();

  const submitQuestion = () => {
    if (question) {
      trigger({
        question,
      });
    }
  };

  const isQuestionMode = focused || question;

  const onLogout = async () => {
    await logout({});
    globalThis.location.reload();
  };

  const hasLeaderboard = event?.features["leaderboard"] ?? false;

  return (
    <>
      <div className="overlay-container">
        <div className="target question-input">
          <Flex gap={2} flexFlow="row" alignItems="flex-start">
            <Textarea
              resize="vertical"
              size="lg"
              minH="48px"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitQuestion();
                }
              }}
              disabled={!isAuthenticated}
              placeholder="Type a question..."
              name="question"
              bg="#342749"
              color="white"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              rows={isQuestionMode ? 3 : 1}
              borderColor={primaryPurple}
              border="none"
              borderRadius="md"
              paddingTop="12px"
              maxLength={MAX_QUESTION_LENGTH}
            />
            <IconButton
              isDisabled={!isAuthenticated}
              size="lg"
              onClick={submitQuestion}
              bg="purple.500"
              _hover={{ bg: "purple.600" }}
              icon={<SendIcon />}
              aria-label="Submit question"
            />
            {!isQuestionMode
              ? (
                <IconButton
                  isDisabled={!isAuthenticated}
                  onClick={() => {
                    onReactClick();
                    setIsTutorialHeartFinished(true);
                  }}
                  variant="ghost"
                  size="lg"
                  icon={
                    <div
                      className={!isTutorialHeartFinished && isAuthenticated
                        ? "pulsate"
                        : undefined}
                    >
                      <HeartIcon />
                    </div>
                  }
                  borderColor="purple.500"
                  aria-label="React to event"
                  type="button"
                />
              )
              : null}
          </Flex>
          <span className="signin-name">
            Signed as{" "}
            <ChakraLink onClick={onOpen}>
              {user?.name ?? user?.uid ?? "Anonymous"}
            </ChakraLink>{" "}
            {hasLeaderboard && (
              <Button
                variant="outline"
                as={Link}
                size="xs"
                to="/leaderboard"
                fontWeight="bold"
                padding="16px 8px"
                fontSize="16px"
                borderRadius="999px"
              >
                🦄 {user?.points ?? 0}
              </Button>
            )}
          </span>
        </div>
        {!isAuthenticated && !isUserLoading && (
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
