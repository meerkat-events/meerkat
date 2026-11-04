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
  Popover,
  Portal,
  Text,
} from "@chakra-ui/react";
import { useBlockUser } from "../../hooks/use-block-user.ts";
import type { Question as QuestionType } from "../../types.ts";
import { useMarkAsAnswered } from "../../hooks/use-mark-as-answered.ts";
import { UpVoteButton } from "../Buttons/UpVoteButton.tsx";
import { useHideQuestion } from "../../hooks/use-hide-question.ts";
import { FiRadio } from "react-icons/fi";
import {
  BiCircle,
  BiCircleHalf,
  BiCircleQuarter,
  BiCircleThreeQuarter,
  BiSolidCircle,
} from "react-icons/bi";
import { useSelectQuestion } from "../../hooks/use-select-question.ts";
import {
  CONFIRMATION_DURATION,
  toaster,
} from "../../components/ui/toaster.tsx";
import { useVote } from "../../hooks/use-vote.ts";
import { tapTargetStyles } from "../../theme/index.ts";
import { useRef, useState } from "react";
import { SupervotePrompt } from "./SupervotePrompt.tsx";
import {
  RELEVANCE_LEVELS,
  relevanceIndex,
  relevanceLevel,
} from "../Manage/question-state.ts";
import { useSwipeReveal } from "./use-swipe.ts";

/**
 * Whether moderators see each question's relevance score after its text.
 * Off while we iterate on its design; the API still sends the score.
 */
const SHOW_RELEVANCE_SCORE = false;

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
            // Clicks in portalled children (the options menu) reach here too.
            if (!event.currentTarget.contains(event.target as Node)) return;
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
          {SHOW_RELEVANCE_SCORE && canModerate && question.relevance != null && (
            <>
              {" "}
              <RelevanceScore score={question.relevance} />
            </>
          )}
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
                    flexShrink={0}
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
                      {/* An answered question can go back on stage. */}
                      {!isSelected && (
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

/** A quarter more of the pie per relevance level, from 0 (empty) to 4 (full). */
const RELEVANCE_ICONS = [
  BiCircle,
  BiCircleQuarter,
  BiCircleHalf,
  BiCircleThreeQuarter,
  BiSolidCircle,
];

/**
 * Automatic moderation's relevance score, small, for moderators, at the end
 * of the question text. Tapping it opens a short explanation, sized for
 * phones (/manage has the long one).
 */
function RelevanceScore({ score }: { score: number }) {
  const formatted = `${score.toFixed(1)}/4`;
  const level = relevanceLevel(score);

  return (
    <Popover.Root positioning={{ placement: "bottom-start" }}>
      <Popover.Trigger asChild>
        <chakra.button
          type="button"
          position="relative"
          display="inline-flex"
          alignItems="center"
          gap="1"
          verticalAlign="middle"
          whiteSpace="nowrap"
          textStyle="xs"
          fontWeight="normal"
          color="fg.muted"
          fontVariantNumeric="tabular-nums"
          cursor="pointer"
          borderRadius="sm"
          _hover={{ color: "fg" }}
          focusVisibleRing="outside"
          aria-label={`Relevance ${score.toFixed(1)} of 4: ${level}`}
          {...tapTargetStyles}
        >
          <Icon as={RELEVANCE_ICONS[relevanceIndex(score)]} aria-hidden />
          {formatted}
        </chakra.button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content maxW="2xs" textStyle="sm">
            <Popover.Arrow>
              <Popover.ArrowTip />
            </Popover.Arrow>
            <Popover.Body display="flex" flexDirection="column" gap="2" p="3">
              <Popover.Title fontWeight="semibold">
                Relevance {formatted} · {level}
              </Popover.Title>
              <Text color="fg.muted">
                How well the question fits this talk, rated by the moderation
                model. It never hides a question.
              </Text>
              <chakra.ol color="fg.muted" fontVariantNumeric="tabular-nums">
                {RELEVANCE_LEVELS.map((relevance, value) => (
                  <li key={relevance.name}>{value} · {relevance.name}</li>
                ))}
              </chakra.ol>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
