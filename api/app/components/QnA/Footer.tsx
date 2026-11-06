import { FiSend } from "react-icons/fi";
import {
  Box,
  Button,
  IconButton,
  Link as ChakraLink,
  Text,
  Textarea,
} from "@chakra-ui/react";
import type { Event } from "../../types.ts";
import { tapTargetStyles } from "../../theme/index.ts";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useAskQuestion } from "../../hooks/use-ask-question.ts";
import { CONFIRMATION_DURATION, toaster } from "../ui/toaster.tsx";
import { useAnonymousUser } from "../../hooks/use-anonymous-user.ts";
import type { User } from "../../hooks/use-auth.ts";
import { ATTENDEES_ONLY_FEATURE } from "../../../features.ts";
import { MAX_CHARS_PER_QUESTION } from "../../../moderation.ts";
import { QuestionLengthCounter } from "./QuestionLengthCounter.tsx";

import "./Footer.css";

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
  // One sign-in per tap: a second one would create another anonymous user.
  const [isJoining, setIsJoining] = useState(false);
  const join = async () => {
    setIsJoining(true);
    try {
      await loginAnonymousUser();
    } finally {
      setIsJoining(false);
    }
  };

  // Toasts sit in line with the heart bubble above the footer (see app.css),
  // so they need the footer's height, which grows with the question input.
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      root.style.setProperty("--footer-height", `${container.offsetHeight}px`);
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--footer-height");
    };
  }, []);

  const [question, setQuestion] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lengthDescriptionId = useId();
  const hasText = question.length > 0;

  // Grow and shrink the input with its content (capped by maxH below).
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const borders = textarea.offsetHeight - textarea.clientHeight;
    textarea.style.height = `${textarea.scrollHeight + borders}px`;
    // Typing at the end of a question taller than the field: scroll to its
    // very end, bottom padding included, so the last line stays above the
    // character count. The browser would only scroll the caret into view.
    if (textarea.selectionEnd === textarea.value.length) {
      textarea.scrollTop = textarea.scrollHeight;
    }
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
    // Without the event there is nothing to post to: the mutation has no key.
    if (question && event) {
      trigger({
        question,
      });
    }
  };

  return (
    <div className="overlay-container" ref={containerRef}>
      <div className="target question-input">
        {/* The send button sits inside the field, in its bottom corner as a
            long question grows. Once there is text, the character count
            sits in the opposite corner. */}
        <Box position="relative">
          <Textarea
            ref={textareaRef}
            resize="none"
            rows={1}
            // Once there is text, a strip at the bottom holds the count,
            // and the field is taller by as much so as many lines show.
            maxH={hasText ? "11rem" : "9.25rem"}
            paddingBottom={hasText ? "10" : undefined}
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
            // The conference-app hint takes the placeholder's place
            placeholder={showDevconPrompt ? "" : "Type a question..."}
            name="question"
            borderRadius="questionInput"
            borderColor="transparent"
            background="bg.subtle"
            _placeholder={{ color: "fg.muted" }}
            _focusVisible={{
              borderColor: "transparent",
            }}
            maxLength={MAX_CHARS_PER_QUESTION}
            aria-describedby={lengthDescriptionId}
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
          <QuestionLengthCounter
            length={question.length}
            maxLength={MAX_CHARS_PER_QUESTION}
            descriptionId={lengthDescriptionId}
            className="question-counter"
          />
        </Box>
        {/* Guests have no account yet; one is created only when they
            join the conversation. */}
        {isAuthenticated && (
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
              {user?.user_metadata["name"] ?? user?.id}
            </ChakraLink>
          </span>
        )}
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
              color="fg.muted"
              textAlign="center"
            >
              Open this session from the conference app
            </Text>
          </LoginOverlay>
        )
        : !isAuthenticated && !isUserLoading && event &&
          !event.conference.features[ATTENDEES_ONLY_FEATURE] && (
          <LoginOverlay>
            <Button
              variant="solid"
              size="lg"
              _hover={{ bg: "brand.hover" }}
              loading={isJoining}
              loadingText="Joining..."
              onClick={join}
            >
              Join conversation
            </Button>
          </LoginOverlay>
        )}
    </div>
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
