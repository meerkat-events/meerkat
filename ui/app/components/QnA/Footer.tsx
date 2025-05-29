import { FiArrowUpRight as ExternalLinkIcon } from "react-icons/fi";
import { FiSend } from "react-icons/fi";
import {
  Button,
  CloseButton,
  Flex,
  IconButton,
  Link as ChakraLink,
  Textarea,
  useDisclosure,
} from "@chakra-ui/react";
import { Link } from "react-router";
import { useLocalStorage } from "@uidotdev/usehooks";
import { useTicketProof } from "../../hooks/use-ticket-proof.ts";
import type { Event, User } from "../../types.ts";
import { PrimaryButton } from "../Buttons/PrimaryButton.tsx";
import { HeartIcon } from "./HeartIcon.tsx";
import { useState } from "react";
import { useAskQuestion } from "../../hooks/use-ask-question.ts";
import { Dialog } from "@chakra-ui/react";
import { useLogin } from "../../hooks/use-login.ts";
import { useLogout } from "../../hooks/use-logout.ts";
import { toaster } from "../ui/toaster.tsx";

import "./Footer.css";

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
  const [focused, setFocused] = useState(false);

  const hasZupassLogin = event?.features["zupass-login"] ?? false;

  const { login, isLoading } = hasZupassLogin
    ? useLogin({
      conferenceId: event?.conferenceId,
      onError: (error) => {
        toaster.create({
          title: `Failed to login`,
          type: "error",
          description: error.message,
          duration: 2000,
        });
      },
    })
    : useTicketProof({
      conferenceId: event?.conferenceId,
      onError: (error) => {
        toaster.create({
          title: `Failed to login`,
          type: "error",
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
      toaster.create({
        title: "Question added 🎉",
        type: "success",
        duration: 2000,
      });
      refresh();
      setQuestion("");
    },
    onError: (error) => {
      toaster.create({
        title: `Failed to create question`,
        type: "error",
        description: error.message,
        duration: 2000,
      });
    },
  });

  const { open: isOpen, onOpen, onClose } = useDisclosure();

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
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              rows={isQuestionMode ? 3 : 1}
              borderRadius="md"
              paddingTop="12px"
              maxLength={MAX_QUESTION_LENGTH}
            />
            <IconButton
              disabled={!isAuthenticated}
              size="lg"
              onClick={submitQuestion}
              aria-label="Submit question"
            >
              <FiSend />
            </IconButton>
            {!isQuestionMode
              ? (
                <IconButton
                  disabled={!isAuthenticated}
                  onClick={() => {
                    onReactClick();
                    setIsTutorialHeartFinished(true);
                  }}
                  variant="ghost"
                  size="lg"
                  aria-label="React to event"
                  type="button"
                >
                  <div
                    className={!isTutorialHeartFinished && isAuthenticated
                      ? "pulsate"
                      : undefined}
                  >
                    <HeartIcon />
                  </div>
                </IconButton>
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
                size="xs"
                fontWeight="bold"
                asChild
                padding="16px 8px"
                fontSize="16px"
                borderRadius="999px"
              >
                <Link to="/leaderboard">
                  🦄 {user?.points ?? 0}
                </Link>
              </Button>
            )}
          </span>
        </div>
        {!isAuthenticated && !isUserLoading && (
          <LoginOverlay>
            <PrimaryButton
              loading={isLoading}
              loadingText="Connecting..."
              onClick={() => login()}
            >
              Login with Zupass <ExternalLinkIcon />
            </PrimaryButton>
          </LoginOverlay>
        )}
      </div>
      <Dialog.Root
        role="alertdialog"
        open={isOpen}
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
