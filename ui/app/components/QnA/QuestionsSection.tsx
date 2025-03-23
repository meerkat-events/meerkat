import { useMemo } from "react";
import type { Event, Question as QuestionType } from "../../types.ts";
import type { Vote } from "../../hooks/use-votes.ts";
import { Question } from "./Question.tsx";
import { Flex } from "@chakra-ui/react";

export type QuestionsSectionProps = {
  event: Event | undefined;
  questions: QuestionType[] | undefined;
  votes: Vote[] | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  isOrganizer: boolean;
  refresh: () => void;
};

export function QuestionsSection(
  { event, questions, votes, isAuthenticated, isOrganizer, refresh, isLoading }:
    QuestionsSectionProps,
) {
  const questionLookup = useMemo(() => {
    return votes?.reduce((acc, vote) => {
      acc.add(vote.questionUid);
      return acc;
    }, new Set());
  }, [votes, questions]);

  const hasQuestions = !!questions?.length;

  return (
    <>
      {hasQuestions
        ? (
          <ol className="question-list">
            {questions.map((question) => (
              <Question
                key={question.uid}
                event={event}
                question={question}
                canModerate={isOrganizer}
                canVote={isAuthenticated}
                refresh={refresh}
                voted={questionLookup?.has(question.uid) ?? false}
              />
            ))}
          </ol>
        )
        : isLoading
          ? (
            <Flex alignItems="center" justifyContent="center" flex="1">
              Loading...
            </Flex>
          )
          : (
            <Flex alignItems="center" justifyContent="center" flex="1">
              <span>No questions, yet. Be first to ask!</span>
            </Flex>
          )}
    </>
  );
}
