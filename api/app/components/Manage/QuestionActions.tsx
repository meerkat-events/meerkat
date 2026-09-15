import {
  FiCheckCircle as CheckCircleIcon,
  FiEyeOff as DeleteIcon,
  FiMoreHorizontal,
  FiStopCircle as NotAllowedIcon,
} from "react-icons/fi";
import { RxCursorArrow } from "react-icons/rx";
import { Box, Icon, IconButton, Menu, Portal } from "@chakra-ui/react";
import { useBlockUser } from "../../hooks/use-block-user.ts";
import { useMarkAsAnswered } from "../../hooks/use-mark-as-answered.ts";
import { useDeleteQuestion } from "../../hooks/use-delete-question.ts";
import { useSelectQuestion } from "../../hooks/use-select-question.ts";
import { toaster } from "../ui/toaster.tsx";
import type { Question } from "../../types.ts";

/**
 * The question card's "⋯" menu, for lists that aren't cards (the feed table).
 * Same actions, wording and toasts as app/components/QnA/Question.tsx.
 */
export function QuestionActions(
  { question, refresh }: { question: Question; refresh: () => void },
) {
  const { trigger: block } = useBlockUser(question.user?.id ?? "");
  const { trigger: markAsAnswered } = useMarkAsAnswered(question.uid);
  const { trigger: deleteQuestion } = useDeleteQuestion(question.uid);
  const { trigger: selectQuestion } = useSelectQuestion(question.uid);

  const run = async (
    action: () => Promise<unknown>,
    title: string,
    confirmText?: string,
  ) => {
    if (confirmText && !confirm(confirmText)) return;
    try {
      await action();
      refresh();
      toaster.create({ title, type: "success", duration: 1000 });
    } catch (error) {
      toaster.create({
        title: "That didn't work",
        type: "error",
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <Menu.Root positioning={{ placement: "bottom-end" }}>
      <Menu.Trigger asChild>
        <IconButton
          size="xs"
          aria-label={`Options for the question by ${question.user?.name ?? "this person"}`}
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
            <Menu.Item
              value="select"
              onClick={() =>
                run(() => selectQuestion(), "Question selected ✅")}
            >
              <Icon as={RxCursorArrow} mr="2" />
              <Box as="span">Select for Answering</Box>
            </Menu.Item>
            <Menu.Item
              value="answer"
              onClick={() =>
                run(() => markAsAnswered(), "Question marked as answered ✅")}
            >
              <Icon as={CheckCircleIcon} mr="2" />
              <Box as="span">Mark as Answered</Box>
            </Menu.Item>
            <Menu.Item
              value="delete"
              onClick={() =>
                run(() => deleteQuestion(), "Question deleted 🗑️")}
            >
              <Icon as={DeleteIcon} mr="2" />
              <Box as="span">Hide Question</Box>
            </Menu.Item>
            <Menu.Item
              value="block"
              onClick={() =>
                run(
                  () => block(),
                  "User blocked 🚫",
                  "Are you sure you want to block this user?",
                )}
            >
              <Icon as={NotAllowedIcon} mr="2" />
              <Box as="span">Block User</Box>
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
