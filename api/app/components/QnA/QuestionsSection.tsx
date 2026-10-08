import type { Question as QuestionType } from "../../types.ts";
import { Question, type QuestionSupervotes } from "./Question.tsx";
import { Flex } from "@chakra-ui/react";
import type { LeaderboardPlace } from "../Leaderboard/podium.ts";

export type QuestionsSectionProps = {
  questions: QuestionType[] | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  canModerate: boolean;
  refresh: () => void;
  supervotes?: QuestionSupervotes | undefined;
  /** Everyone's leaderboard place, keyed by user id. */
  places?: Map<string, LeaderboardPlace>;
  /** Opens an author's leaderboard details from their badge. */
  onBadgeSelect?: ((userId: string) => void) | undefined;
};

export function QuestionsSection(
  {
    questions,
    isAuthenticated,
    canModerate,
    refresh,
    isLoading,
    supervotes,
    places,
    onBadgeSelect,
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
                canVote={isAuthenticated}
                refresh={refresh}
                voted={!!question.vote}
                supervotes={supervotes}
                supervoted={!!question.vote && question.vote.weight > 1}
                place={question.user ? places?.get(question.user.id) : undefined}
                onBadgeSelect={question.user && onBadgeSelect
                  ? () => onBadgeSelect(question.user!.id)
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
