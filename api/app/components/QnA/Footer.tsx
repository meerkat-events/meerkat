import { FiSend } from "react-icons/fi";
import {
  Box,
  IconButton,
  Link as ChakraLink,
  Text,
  Textarea,
} from "@chakra-ui/react";
import type { Event } from "../../types.ts";
import { PrimaryButton } from "../Buttons/PrimaryButton.tsx";
import { tapTargetStyles } from "../../theme/index.ts";
import { useLayoutEffect, useRef, useState } from "react";
import { useAskQuestion } from "../../hooks/use-ask-question.ts";
import { CONFIRMATION_DURATION, toaster } from "../ui/toaster.tsx";
import { useAnonymousUser } from "../../hooks/use-anonymous-user.ts";
import type { User } from "../../hooks/use-auth.ts";
import { ATTENDEES_ONLY_FEATURE } from "../../../features.ts";

import "./Footer.css";

const MAX_QUESTION_LENGTH = 200;

export type FooterProps = {
  event: Event | undefined;
  isAuthenticated: boolean;
  /** Signed in, and allowed to take part in this conference. */
  canParticipate: boolean;
  /**
   * The conference is attendees-only and this visitor has no role there:
   * an overlay points them to the conference app.
   */
  showDevconPrompt: boolean;
  isUserLoading: boolean;
  user: User | undefined;
  refresh: () => void;
  /** Opens the signed-in user's own profile, from their name. */
  onProfileOpen: () => void;
};

export function Footer({
  event,
  isAuthenticated,
  canParticipate,
  showDevconPrompt,
  isUserLoading,
  user,
  refresh,
  onProfileOpen,
}: FooterProps) {
  const { login: loginAnonymousUser } = useAnonymousUser();

  const [question, setQuestion] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Grow and shrink the input with its content (capped by maxH below).
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const borders = textarea.offsetHeight - textarea.clientHeight;
    textarea.style.height = `${textarea.scrollHeight + borders}px`;
  }, [question]);

  const { trigger, isMutating } = useAskQuestion(event, {
    onSuccess: () => {
      toaster.create({
        title: "Question added",
        type: "success",
        duration: CONFIRMATION_DURATION,
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

  const submitQuestion = () => {
    if (question) {
      trigger({
        question,
      });
    }
  };

  return (
    <>
      <div className="overlay-container">
        <div className="target question-input">
          {/* The send button sits inside the field, in its bottom corner as a
              long question grows. */}
          <Box position="relative">
            <Textarea
              ref={textareaRef}
              resize="none"
              rows={1}
              maxH="9.25rem"
              overflowY="auto"
              size="lg"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitQuestion();
                }
              }}
              disabled={!canParticipate}
              placeholder="Type a question..."
              name="question"
              borderRadius="questionInput"
              borderColor="transparent"
              background="bg.subtle"
              _placeholder={{ color: "fg.muted" }}
              _focusVisible={{
                borderColor: "transparent",
              }}
              maxLength={MAX_QUESTION_LENGTH}
              paddingEnd="14"
              // Block, so the wrapper ends where the field does
              display="block"
            />
            <IconButton
              loading={isMutating}
              disabled={!canParticipate}
              size="md"
              onClick={submitQuestion}
              aria-label="Submit question"
              position="absolute"
              insetEnd="5px"
              bottom="5px"
              h="40px"
              w="40px"
              minW="40px"
              borderRadius="full"
              _hover={{ bg: "brand.hover" }}
            >
              <FiSend />
            </IconButton>
          </Box>
          <span className="signin-name">
            Signed as{" "}
            <ChakraLink
              as="button"
              onClick={onProfileOpen}
              position="relative"
              // The full tap target, shifted down into the padding below so
              // it stays off the question input just above
              _before={{
                ...tapTargetStyles._before,
                transform: "translate(-50%, calc(-50% + 6px))",
              }}
            >
              {user?.user_metadata["name"] ?? user?.id ?? "Anonymous"}
            </ChakraLink>
          </span>
        </div>
        {/* Attendees-only conferences offer no anonymous sign-in: people
            without a role there are pointed to the conference app instead. */}
        {showDevconPrompt
          ? (
            <LoginOverlay>
              <Text
                // Positioned, so it paints above the positioned field below
                // it, like the Join button does
                position="relative"
                bg="brand.subtle"
                borderWidth="1px"
                borderColor="brand.muted"
                color="fg"
                fontWeight="semibold"
                textAlign="center"
                paddingX="4"
                paddingY="2"
                borderRadius="l2"
              >
                Open this session in the Conference App
              </Text>
            </LoginOverlay>
          )
          : !isAuthenticated && !isUserLoading && event &&
            !event.conference.features[ATTENDEES_ONLY_FEATURE] && (
            <LoginOverlay>
              <PrimaryButton
                loadingText="Joining..."
                onClick={() => loginAnonymousUser()}
              >
                Join conversation
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
      {children}
    </div>
  );
}
