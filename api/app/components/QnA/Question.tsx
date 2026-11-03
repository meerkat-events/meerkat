import {
  FiAlertOctagon as SpamIcon,
  FiCheckCircle as CheckCircleIcon,
  FiMoreHorizontal,
  FiStopCircle as NotAllowedIcon,
} from "react-icons/fi";
import {
  Box,
  chakra,
  Icon,
  IconButton,
  Menu,
  Portal,
  Text,
} from "@chakra-ui/react";
import { useBlockUser } from "../../hooks/use-block-user.ts";
import type { Question as QuestionType } from "../../types.ts";
import { useMarkAsAnswered } from "../../hooks/use-mark-as-answered.ts";
import { UpVoteButton } from "../Buttons/UpVoteButton.tsx";
import { useHideQuestion } from "../../hooks/use-hide-question.ts";
import { FiRadio } from "react-icons/fi";
import { useSelectQuestion } from "../../hooks/use-select-question.ts";
import {
  CONFIRMATION_DURATION,
  toaster,
} from "../../components/ui/toaster.tsx";
import { useVote } from "../../hooks/use-vote.ts";
import { tapTargetStyles } from "../../theme/index.ts";
import { useRef, useState } from "react";
import { SupervotePrompt } from "./SupervotePrompt.tsx";
import { useSwipeReveal } from "./use-swipe.ts";

// Space (px) between the revealed buttons and the swiped card.
const SWIPE_GAP = 8;

export type QuestionSupervotes = {
  /** Supervotes the user can spend; the prompt only shows when above 0. */
  available: number;
  weight: number;
};

interface QuestionProps {
  canVote: boolean;
  canModerate: boolean;
  question: QuestionType;
  voted: boolean;
  refresh: () => void;
  supervotes?: QuestionSupervotes | undefined;
  supervoted?: boolean;
  /** The question on stage right now (see splitAnswering). */
  answering: boolean;
  /** Opens the author's points from their name. */
  onAuthorSelect?: (() => void) | undefined;
}

export function Question(
  {
    canVote,
    canModerate,
    question,
    voted,
    refresh,
    supervotes,
    supervoted,
    answering,
    onAuthorSelect,
  }: QuestionProps,
) {
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const authorName = question.user?.name ?? question.user?.id ?? "Unknown";
  // Set while a supervoted vote is in flight, so its toast can say so.
  const isSupervotingRef = useRef(false);
  // The vote endpoint toggles, so remember whether this tap adds the vote:
  // only an added vote gets a confirmation.
  const isAddingVote = useRef(false);
  const { trigger: toggleVote, isMutating: isVoting } = useVote(question.uid, {
    onSuccess: () => {
      refresh();
      if (isSupervotingRef.current && supervotes) {
        isSupervotingRef.current = false;
        toaster.create({
          title: "Supervote used",
          description:
            `Your vote counts x${supervotes.weight} on this question.`,
          type: "success",
          duration: 3000,
          meta: { hideIndicator: true },
        });
        return;
      }
      if (isAddingVote.current) {
        toaster.create({
          title: "Vote recorded",
          type: "success",
          duration: CONFIRMATION_DURATION,
        });
      }
    },
    onError: (error) => {
      isSupervotingRef.current = false;
      // 409: no supervotes left (spent elsewhere) or the vote changed in the
      // meantime. Refetch, so the counter and the vote pill catch up.
      if (error.status === 409) {
        refresh();
      }
      toaster.create({
        title: `Failed to vote`,
        type: "error",
        description: error.message,
      });
    },
  });
  const handleVoteClick = () => {
    if (!voted && supervotes && supervotes.available > 0) {
      setIsPromptOpen(true);
      return;
    }
    isAddingVote.current = !voted;
    toggleVote({ uid: question.uid });
  };

  const { trigger: block } = useBlockUser(question.user?.id ?? "");
  const { trigger: markAsAnswered } = useMarkAsAnswered(question.uid);
  const { trigger: hideQuestion } = useHideQuestion(question.uid);
  const { trigger: selectQuestion } = useSelectQuestion(question.uid);

  const handleBlock = async () => {
    const result = await confirm("Are you sure you want to block this user?");

    if (!result) {
      return;
    }

    await block();
    refresh();

    toaster.create({
      title: "User blocked",
      type: "success",
      duration: CONFIRMATION_DURATION,
    });
  };

  const handleAnswered = async () => {
    await markAsAnswered();
    refresh();
    toaster.create({
      title: "Question answered",
      type: "success",
      duration: CONFIRMATION_DURATION,
    });
  };

  const handleHide = async () => {
    await hideQuestion();
    refresh();
    toaster.create({
      title: "Question marked as spam",
      type: "success",
      duration: CONFIRMATION_DURATION,
    });
  };

  const handleSelected = async () => {
    await selectQuestion();
    refresh();
    toaster.create({
      title: "Question highlighted",
      type: "success",
      duration: CONFIRMATION_DURATION,
    });
  };

  const isAnswered = !!question.answeredAt;
  const isSelected = answering;

  const canSwipe = canModerate && !isAnswered;
  // Swipe right to reveal Highlight and Answered underneath the card. Each
  // button takes 5.5rem (88px) including the gap after it.
  const { ref, offset, isDragging, isOpen, close, handlers } = useSwipeReveal({
    width: isSelected
      ? 88
      : 176,
    enabled: canSwipe,
  });

  const classNames = [
    "question-card",
    isAnswered ? "answered" : "",
    isSelected ? "selected" : "",
  ];

  return (
    <li
      ref={ref}
      className={[
        "question-swipe",
        canSwipe ? "swipeable" : "",
        isDragging ? "dragging" : "",
      ].join(" ")}
      {...handlers}
    >
      {offset > 0 && (
        <div
          className="question-swipe-actions"
          // Stop short of the card so a half-revealed button never shows in
          // the gaps around the card's rounded corners.
          style={{ width: Math.max(0, offset - SWIPE_GAP) }}
        >
          {!isSelected && (
            <button
              type="button"
              className="question-swipe-action highlight"
              tabIndex={isOpen ? 0 : -1}
              onClick={() => {
                close();
                handleSelected();
              }}
            >
              <Icon as={FiRadio} boxSize="5" />
              Highlight
            </button>
          )}
          <button
            type="button"
            className="question-swipe-action answered"
            tabIndex={isOpen ? 0 : -1}
            onClick={() => {
              close();
              handleAnswered();
            }}
          >
            <Icon as={CheckCircleIcon} boxSize="5" />
            Answered
          </button>
        </div>
      )}
      <div
        className={classNames.join(" ")}
        style={offset
          ? { transform: `translateX(${offset}px)` }
          : undefined}
        onClickCapture={isOpen
          ? (event) => {
            event.stopPropagation();
            close();
          }
          : undefined}
      >
        {isSelected && (
          <div className="question-card-status">
            <Icon as={FiRadio} />
            Answering
          </div>
        )}
        <Text className="question-card-text" textStyle="md" fontWeight="semibold">
          {question.question}
        </Text>
        <div className="question-card-meta">
          <div className="question-card-byline">
            {onAuthorSelect
              ? (
                <chakra.button
                  type="button"
                  onClick={onAuthorSelect}
                  // Relative and not clipped, so the tap target can reach
                  // beyond the line of text; the name itself truncates
                  position="relative"
                  display="inline-flex"
                  minW="0"
                  textStyle="sm"
                  color="fg.muted"
                  cursor="pointer"
                  borderRadius="sm"
                  _hover={{ color: "fg", textDecoration: "underline" }}
                  focusVisibleRing="outside"
                  aria-label={`Show ${authorName}'s points`}
                  {...tapTargetStyles}
                >
                  <chakra.span truncate>{authorName}</chakra.span>
                </chakra.button>
              )
              : (
                <Text as="span" textStyle="sm" color="fg.muted" minW="0" truncate>
                  {authorName}
                </Text>
              )}
            {canModerate && (
              <Menu.Root positioning={{ placement: "bottom-start" }}>
                <Menu.Trigger asChild>
                  <IconButton
                    {...tapTargetStyles}
                    size="sm"
                    h="questionControl"
                    minW="questionControl"
                    aria-label="Options"
                    variant="ghost"
                    colorPalette="gray"
                    color="accent.icon"
                  >
                    <Icon as={FiMoreHorizontal} />
                  </IconButton>
                </Menu.Trigger>
                <Portal>
                  <Menu.Positioner>
                    <Menu.Content>
                      {!isSelected && !isAnswered && (
                        <Menu.Item value="select" onClick={handleSelected}>
                          <Icon as={FiRadio} mr="2" color="accent.menuIcon" />
                          <Box as="span">Highlight</Box>
                        </Menu.Item>
                      )}
                      {!isAnswered && (
                        <Menu.Item value="answer" onClick={handleAnswered}>
                          <Icon
                            as={CheckCircleIcon}
                            mr="2"
                            color="accent.menuIcon"
                          />
                          <Box as="span">Answered</Box>
                        </Menu.Item>
                      )}
                      <Menu.Item value="hide" onClick={handleHide}>
                        <Icon as={SpamIcon} mr="2" color="accent.menuIcon" />
                        <Box as="span">Spam</Box>
                      </Menu.Item>
                      <Menu.Item value="block" onClick={handleBlock}>
                        <Icon as={NotAllowedIcon} mr="2" color="accent.menuIcon" />
                        <Box as="span">Block User</Box>
                      </Menu.Item>
                    </Menu.Content>
                  </Menu.Positioner>
                </Portal>
              </Menu.Root>
            )}
          </div>
          <UpVoteButton
            votes={question.votes}
            voted={voted}
            loading={isVoting}
            supervoted={supervoted}
            onClick={handleVoteClick}
            // A supervote is spent for good: it can't be un-voted.
            disabled={!canVote || isAnswered || supervoted}
          />
          {supervotes && (
            <SupervotePrompt
              open={isPromptOpen}
              available={supervotes.available}
              weight={supervotes.weight}
              onSupervote={() => {
                setIsPromptOpen(false);
                isSupervotingRef.current = true;
                toggleVote({ uid: question.uid, weight: supervotes.weight });
              }}
              onRegularVote={() => {
                setIsPromptOpen(false);
                isAddingVote.current = true;
                toggleVote({ uid: question.uid });
              }}
              onCancel={() => setIsPromptOpen(false)}
            />
          )}
        </div>
      </div>
    </li>
  );
}
