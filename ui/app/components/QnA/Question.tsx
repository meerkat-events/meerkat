import { CheckCircleIcon, DeleteIcon, NotAllowedIcon } from "@chakra-ui/icons";
import {
  Heading,
  Icon,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  useToast,
} from "@chakra-ui/react";
import { MdMoreHoriz } from "react-icons/md";
import { useAsyncFormSubmit } from "../../hooks/use-async-form-submit.ts";
import { useBlockUser } from "../../hooks/use-block-user.ts";
import type { Question as QuestionType, Event } from "../../types.ts";
import { useMarkAsAnswered } from "../../hooks/use-mark-as-answered.ts";
import { UpVoteButton } from "../Buttons/UpVoteButton.tsx";
import { useDeleteQuestion } from "../../hooks/use-delete-question.ts";
import { posthog } from "posthog-js";

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
  const toast = useToast();
  const { onSubmit } = useAsyncFormSubmit({
    onSuccess: () => {
      refresh();
      toast({
        title: "Vote recorded 🗳️",
        status: "success",
        duration: 1000,
      });
      posthog.capture("vote_toggled", {
        question_uid: question.uid,
        event_uid: event?.uid,
      });
    },
    onError: (error) => {
      toast({
        title: `Failed to vote`,
        status: "error",
        description: error.message,
      });
    },
  });
  const { trigger: block } = useBlockUser(question.user?.uid ?? "");
  const { trigger: markAsAnswered } = useMarkAsAnswered(question.uid);
  const { trigger: deleteQuestion } = useDeleteQuestion(question.uid);

  const handleBlock = async () => {
    const result = await confirm("Are you sure you want to block this user?");

    if (!result) {
      return;
    }

    await block();
    refresh();

    toast({
      title: "User blocked 🚫",
      status: "success",
      duration: 1000,
    });
  };

  const handleAnswered = async () => {
    await markAsAnswered();
    toast({
      title: "Question marked as answered ✅",
      status: "success",
      duration: 1000,
    });
  };

  const handleDelete = async () => {
    await deleteQuestion();
    refresh();
    toast({
      title: "Question deleted 🗑️",
      status: "success",
      duration: 1000,
    });
  };

  const isAnswered = !!question.answeredAt;

  return (
    <>
      <li
        key={`${question.uid}-${question.question}`}
        className={`bubble${isAnswered ? " answered" : ""}`}
      >
        <Heading as="h3" color="white" size="sm" mb={2} flex="1">
          {question.question}
        </Heading>
        {canModerate
          ? (
            <Menu>
              <MenuButton
                as={IconButton}
                size="md"
                aria-label="Options"
                icon={<Icon as={MdMoreHoriz} />}
                variant="ghost"
                justifySelf="flex-end"
              />
              <MenuList>
                <MenuItem onClick={handleAnswered} icon={<CheckCircleIcon />}>
                  Mark as Answered
                </MenuItem>
                <MenuItem onClick={handleDelete} icon={<DeleteIcon />}>
                  Delete
                </MenuItem>
                <MenuItem onClick={handleBlock} icon={<NotAllowedIcon />}>
                  Block User
                </MenuItem>
              </MenuList>
            </Menu>
          )
          : <div />}
        <span className="author">
          {question.user?.name ?? question.user?.uid}
        </span>
        <div className="upvote">
          <div className={`upvote-count ${voted && "voted"}`}>
            {question.votes}
          </div>
          <form
            method="POST"
            onSubmit={onSubmit}
            action={`/api/v1/questions/${question.uid}/upvote`}
          >
            <UpVoteButton
              hasVoted={voted}
              isDisabled={!canVote || isAnswered}
            />
          </form>
        </div>
      </li>
    </>
  );
}
