import {
  FiCheckCircle as CheckCircleIcon,
  FiEyeOff as DeleteIcon,
  FiMoreHorizontal,
  FiStopCircle as NotAllowedIcon,
} from "react-icons/fi";
import {
  LuSignal,
  LuSignalHigh,
  LuSignalLow,
  LuSignalMedium,
  LuSignalZero,
} from "react-icons/lu";
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
import { RxCursorArrow } from "react-icons/rx";
import { useSelectQuestion } from "../../hooks/use-select-question.ts";
import {
  CONFIRMATION_DURATION,
  toaster,
} from "../../components/ui/toaster.tsx";
import { useVote } from "../../hooks/use-vote.ts";
import { tapTargetStyles } from "../../theme/index.ts";
import { useRef, useState } from "react";
import { SupervotePrompt } from "./SupervotePrompt.tsx";
import { relevanceIndex, relevanceLevel } from "../Manage/question-state.ts";
import { RelevanceExplanation } from "../Manage/RelevanceInfo.tsx";

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
      title: "Question marked as answered",
      type: "success",
      duration: CONFIRMATION_DURATION,
    });
  };

  const handleHide = async () => {
    await hideQuestion();
    refresh();
    toaster.create({
      title: "Question hidden",
      type: "success",
      duration: CONFIRMATION_DURATION,
    });
  };

  const handleSelected = async () => {
    await selectQuestion();
    refresh();
    toaster.create({
      title: "Question selected",
      type: "success",
      duration: CONFIRMATION_DURATION,
    });
  };

  const isAnswered = !!question.answeredAt;
  const isSelected = answering;

  const classNames = [
    "question-card",
    isAnswered ? "answered" : "",
    isSelected ? "selected" : "",
  ];

  return (
    <li className={classNames.join(" ")}>
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
                    <Menu.Item value="select" onClick={handleSelected}>
                      <Icon as={RxCursorArrow} mr="2" color="accent.menuIcon" />
                      <Box as="span">Select for Answering</Box>
                    </Menu.Item>
                    <Menu.Item value="answer" onClick={handleAnswered}>
                      <Icon as={CheckCircleIcon} mr="2" color="accent.menuIcon" />
                      <Box as="span">Mark as Answered</Box>
                    </Menu.Item>
                    <Menu.Item value="hide" onClick={handleHide}>
                      <Icon as={DeleteIcon} mr="2" color="accent.menuIcon" />
                      <Box as="span">Hide Question</Box>
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
          {canModerate && question.relevance != null && (
            <RelevanceScore score={question.relevance} />
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
    </li>
  );
}

/** One more bar per relevance level, from 0 (Unrelated) to 4 (Excellent). */
const RELEVANCE_ICONS = [
  LuSignalZero,
  LuSignalLow,
  LuSignalMedium,
  LuSignalHigh,
  LuSignal,
];

/**
 * Automatic moderation's relevance score, small, for moderators. Tapping it
 * opens how the score works, as on /manage.
 */
function RelevanceScore({ score }: { score: number }) {
  const formatted = score.toFixed(1);
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
          flexShrink={0}
          textStyle="xs"
          color="fg.muted"
          fontVariantNumeric="tabular-nums"
          cursor="pointer"
          borderRadius="sm"
          _hover={{ color: "fg" }}
          focusVisibleRing="outside"
          aria-label={`Relevance ${formatted} of 4: ${level}. How relevance is scored`}
          {...tapTargetStyles}
        >
          <Icon as={RELEVANCE_ICONS[relevanceIndex(score)]} aria-hidden />
          {formatted}/4
        </chakra.button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content maxW="xs" textStyle="sm">
            <Popover.Arrow>
              <Popover.ArrowTip />
            </Popover.Arrow>
            <Popover.Body
              display="flex"
              flexDirection="column"
              gap="2"
              color="fg.muted"
              css={{
                "& [data-part='title']": { color: "fg", fontWeight: "semibold" },
                "& b": { color: "fg", fontWeight: "semibold" },
                "& ul": { display: "grid", gap: "1" },
              }}
            >
              <Text color="fg">
                This question: <b>{formatted}/4 · {level}</b>
              </Text>
              <RelevanceExplanation />
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
