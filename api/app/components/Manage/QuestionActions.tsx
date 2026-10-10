import {
  FiCheckCircle as CheckCircleIcon,
  FiEyeOff as DeleteIcon,
  FiMoreHorizontal,
  FiRotateCcw as RestoreIcon,
  FiStopCircle as NotAllowedIcon,
} from "react-icons/fi";
import { RxCursorArrow } from "react-icons/rx";
import { Box, Icon, IconButton, Menu, Portal } from "@chakra-ui/react";
import { useMarkAsAnswered } from "../../hooks/use-mark-as-answered.ts";
import { useDeleteQuestion } from "../../hooks/use-delete-question.ts";
import { useSelectQuestion } from "../../hooks/use-select-question.ts";
import { useRestoreQuestion } from "../../hooks/use-restore-question.ts";
import { toaster } from "../ui/toaster.tsx";
import type { ModeratedQuestion } from "./question-state.ts";

/**
 * The question card's "⋯" menu, for lists that aren't cards (the feed table).
 * Same actions, wording and toasts as app/components/QnA/Question.tsx.
 */
export function QuestionActions(
  { question, refresh, onPerson }: {
    question: ModeratedQuestion;
    refresh: () => void;
    /** Opens someone's history, where blocking them is confirmed. */
    onPerson: (userId: string) => void;
  },
) {
  const { trigger: markAsAnswered } = useMarkAsAnswered(question.uid);
  const { trigger: deleteQuestion } = useDeleteQuestion(question.uid);
  const { trigger: selectQuestion } = useSelectQuestion(question.uid);
  const { trigger: restoreQuestion } = useRestoreQuestion(question.uid);
  const autoHidden = !!question.hiddenAt;

  const run = async (action: () => Promise<unknown>, title: string) => {
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
          <Menu.Content className="m-menu">
            {autoHidden
              ? (
                // Only its author sees it: an organizer can show it again, but
                // not put it on stage while it is hidden.
                <Menu.Item
                  value="restore"
                  onClick={() =>
                    run(() => restoreQuestion(), "Question restored, attendees see it again")}
                >
                  <Icon as={RestoreIcon} mr="2" />
                  <Box as="span">Restore Question</Box>
                </Menu.Item>
              )
              : (
                <>
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
                </>
              )}
            {question.user && (
              // Blocking happens in their history, which shows what they did
              // and asks for confirmation there (one dialog at a time).
              <Menu.Item value="block" onClick={() => onPerson(question.user!.id)}>
                <Icon as={NotAllowedIcon} mr="2" />
                <Box as="span">Block User…</Box>
              </Menu.Item>
            )}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
