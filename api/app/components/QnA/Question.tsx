import {
  FiCheckCircle as CheckCircleIcon,
  FiEyeOff as DeleteIcon,
  FiMoreHorizontal,
  FiStopCircle as NotAllowedIcon,
} from "react-icons/fi";
import { Box, Icon, IconButton, Menu, Portal, Text } from "@chakra-ui/react";
import { useBlockUser } from "../../hooks/use-block-user.ts";
import type { Question as QuestionType } from "../../types.ts";
import { useMarkAsAnswered } from "../../hooks/use-mark-as-answered.ts";
import { UpVoteButton } from "../Buttons/UpVoteButton.tsx";
import { useDeleteQuestion } from "../../hooks/use-delete-question.ts";
import { FiRadio } from "react-icons/fi";
import { RxCursorArrow } from "react-icons/rx";
import { useSelectQuestion } from "../../hooks/use-select-question.ts";
import { toaster } from "../../components/ui/toaster.tsx";
import { useVote } from "../../hooks/use-vote.ts";

interface QuestionProps {
  canVote: boolean;
  canModerate: boolean;
  question: QuestionType;
  voted: boolean;
  refresh: () => void;
}

export function Question(
  { canVote, canModerate, question, voted, refresh }: QuestionProps,
) {
  const { trigger: toggleVote, isMutating: isVoting } = useVote(question.uid, {
    onSuccess: () => {
      refresh();
      toaster.create({
        title: "Vote recorded",
        type: "success",
        duration: 1000,
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
    "question-card",
    isAnswered ? "answered" : "",
    isSelected ? "selected" : "",
  ];

  return (
    <li
      key={`${question.uid}-${question.question}`}
      className={classNames.join(" ")}
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
          <Text as="span" textStyle="sm" color="fg.muted" minW="0" truncate>
            {question.user?.name ?? question.user?.id ?? "Unknown"}
          </Text>
          {canModerate && (
            <Menu.Root positioning={{ placement: "bottom-start" }}>
              <Menu.Trigger asChild>
                <IconButton
                  size="sm"
                  aria-label="Options"
                  variant="ghost"
                  colorPalette="gray"
                  color="fg.muted"
                >
                  <Icon as={FiMoreHorizontal} />
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
          )}
        </div>
        <UpVoteButton
          votes={question.votes}
          voted={voted}
          loading={isVoting}
          onClick={() => toggleVote({ uid: question.uid })}
          disabled={!canVote || isAnswered}
        />
      </div>
    </li>
  );
}
