import {
  FiCheckCircle as CheckCircleIcon,
  FiEyeOff as DeleteIcon,
  FiMoreVertical,
  FiStopCircle as NotAllowedIcon,
} from "react-icons/fi";
import { Box, Icon, IconButton, Menu, Portal, Text } from "@chakra-ui/react";
import { useBlockUser } from "../../hooks/use-block-user.ts";
import type { Event, Question as QuestionType } from "../../types.ts";
import { useMarkAsAnswered } from "../../hooks/use-mark-as-answered.ts";
import { UpVoteButton } from "../Buttons/UpVoteButton.tsx";
import { useDeleteQuestion } from "../../hooks/use-delete-question.ts";
import { posthog } from "posthog-js";
import { FiRadio } from "react-icons/fi";
import { RxCursorArrow } from "react-icons/rx";
import { useSelectQuestion } from "../../hooks/use-select-question.ts";
import { toaster } from "../../components/ui/toaster.tsx";
import { useVote } from "../../hooks/use-vote.ts";

interface QuestionProps {
  event: Event | undefined;
  canVote: boolean;
  canModerate: boolean;
  question: QuestionType;
  voted: boolean;
  refresh: () => void;
}

export function Question(
  { event, canVote, canModerate, question, voted, refresh }: QuestionProps,
) {
  const { trigger: toggleVote, isMutating: isVoting } = useVote(question.uid, {
    onSuccess: () => {
      refresh();
      toaster.create({
        title: "Vote recorded 🗳️",
        type: "success",
        duration: 1000,
      });
      posthog.capture("vote_toggled", {
        question_uid: question.uid,
        event_uid: event?.uid,
      });
    },
    onError: (error) => {
      toaster.create({
        title: `Failed to vote`,
        type: "error",
        description: error.message,
      });
    },
  });
  const { trigger: block } = useBlockUser(question.user?.id ?? "");
  const { trigger: markAsAnswered } = useMarkAsAnswered(question.uid);
  const { trigger: deleteQuestion } = useDeleteQuestion(question.uid);
  const { trigger: selectQuestion } = useSelectQuestion(question.uid);

  const handleBlock = async () => {
    const result = await confirm("Are you sure you want to block this user?");

    if (!result) {
      return;
    }

    await block();
    refresh();

    toaster.create({
      title: "User blocked 🚫",
      type: "success",
      duration: 1000,
    });
  };

  const handleAnswered = async () => {
    await markAsAnswered();
    refresh();
    toaster.create({
      title: "Question marked as answered ✅",
      type: "success",
      duration: 1000,
    });
  };

  const handleDelete = async () => {
    await deleteQuestion();
    refresh();
    toaster.create({
      title: "Question deleted 🗑️",
      type: "success",
      duration: 1000,
    });
  };

  const handleSelected = async () => {
    await selectQuestion();
    refresh();
    toaster.create({
      title: "Question selected ✅",
      type: "success",
    });
  };

  const isAnswered = !!question.answeredAt;
  const isSelected = !question.answeredAt && !!question.selectedAt;

  const classNames = [
    "bubble",
    isAnswered ? "answered" : "",
    isSelected ? "selected" : "",
  ];

  return (
    <li
      key={`${question.uid}-${question.question}`}
      className={classNames.join(" ")}
    >
      {isSelected && (
        <div className="bubble-status">
          <Icon as={FiRadio} />
          Answering
        </div>
      )}
      <Text fontSize="md" mb={2} flex="1" fontWeight="600">
        {question.question}
      </Text>
      {canModerate
        ? (
          <Menu.Root>
            <Menu.Trigger asChild>
              <IconButton
                size="md"
                aria-label="Options"
                variant="ghost"
                colorPalette="gray"
                color="gray.300"
                justifySelf="flex-end"
              >
                <Icon as={FiMoreVertical} />
              </IconButton>
            </Menu.Trigger>
            <Portal>
              <Menu.Positioner>
                <Menu.Content>
                  <Menu.Item value="select" onClick={handleSelected}>
                    <Icon as={RxCursorArrow} mr="2" />
                    <Box as="span">Select for Answering</Box>
                  </Menu.Item>
                  <Menu.Item value="answer" onClick={handleAnswered}>
                    <Icon as={CheckCircleIcon} mr="2" />
                    <Box as="span">Mark as Answered</Box>
                  </Menu.Item>
                  <Menu.Item value="delete" onClick={handleDelete}>
                    <Icon as={DeleteIcon} mr="2" />
                    <Box as="span">Hide Question</Box>
                  </Menu.Item>
                  <Menu.Item value="block" onClick={handleBlock}>
                    <Icon as={NotAllowedIcon} mr="2" />
                    <Box as="span">Block User</Box>
                  </Menu.Item>
                </Menu.Content>
              </Menu.Positioner>
            </Portal>
          </Menu.Root>
        )
        : <div />}
      <Text as="span" className="author" fontWeight="400">
        {question.user?.name ?? question.user?.id ?? "Unknown"}
      </Text>
      <div className="upvote">
        <div className={`upvote-count ${voted && "voted"}`}>
          {question.votes}
        </div>
        <UpVoteButton
          loading={isVoting}
          onClick={() => toggleVote({ uid: question.uid })}
          disabled={!canVote || isAnswered}
        />
      </div>
    </li>
  );
}
