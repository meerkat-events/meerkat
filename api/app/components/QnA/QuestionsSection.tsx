import type { Question as QuestionType } from "../../types.ts";
import { Question, type QuestionSupervotes } from "./Question.tsx";
import { Flex } from "@chakra-ui/react";

export type QuestionsSectionProps = {
  questions: QuestionType[] | undefined;
  isLoading: boolean;
  /** Signed in, and allowed to take part in this conference. */
  canVote: boolean;
  canModerate: boolean;
  refresh: () => void;
  supervotes?: QuestionSupervotes | undefined;
  /** Opens an author's points from their name. */
  onAuthorSelect?: ((author: { id: string; name: string }) => void) | undefined;
};

export function QuestionsSection(
  {
    questions,
    canVote,
    canModerate,
    refresh,
    isLoading,
    supervotes,
    onAuthorSelect,
  }: QuestionsSectionProps,
) {
  const hasQuestions = !!questions?.length;

  return (
    <>
      {hasQuestions
        ? (
          <ol className="question-list">
            {questions.map((question) => (
              <Question
                key={question.uid}
                question={question}
                canModerate={canModerate}
                canVote={canVote}
                refresh={refresh}
                voted={!!question.vote}
                supervotes={supervotes}
                supervoted={!!question.vote && question.vote.weight > 1}
                onAuthorSelect={question.user && onAuthorSelect
                  ? () =>
                    onAuthorSelect({
                      id: question.user!.id,
                      name: question.user!.name ?? question.user!.id,
                    })
                  : undefined}
              />
            ))}
          </ol>
        )
        : isLoading
        ? (
          <Flex
            alignItems="center"
            justifyContent="center"
            flex="1"
            textStyle="sm"
            color="fg.muted"
          >
            Loading...
          </Flex>
        )
        : (
          <Flex
            alignItems="center"
            justifyContent="center"
            flex="1"
            textStyle="sm"
            color="fg.muted"
          >
            <span>No questions, yet. Be first to ask!</span>
          </Flex>
        )}
    </>
  );
}
