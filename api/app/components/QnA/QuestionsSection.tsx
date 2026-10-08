import { useMemo } from "react";
import type { Question as QuestionType } from "../../types.ts";
import type { Vote } from "../../hooks/use-votes.ts";
import { Question, type QuestionSupervotes } from "./Question.tsx";
import { Flex } from "@chakra-ui/react";
import type { LeaderboardPlace } from "../Leaderboard/podium.ts";

export type QuestionsSectionProps = {
  questions: QuestionType[] | undefined;
  votes: Vote[] | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  isOrganizer: boolean;
  refresh: () => void;
  supervotes?: QuestionSupervotes | undefined;
  /** Uids of questions the user spent a supervote on. */
  supervoted?: Set<string>;
  /** Everyone's leaderboard place, keyed by user id. */
  places?: Map<string, LeaderboardPlace>;
  /** Opens an author's leaderboard details from their badge. */
  onBadgeSelect?: ((userId: string) => void) | undefined;
};

export function QuestionsSection(
  {
    questions,
    votes,
    isAuthenticated,
    isOrganizer,
    refresh,
    isLoading,
    supervotes,
    supervoted,
    places,
    onBadgeSelect,
  }: QuestionsSectionProps,
) {
  const questionLookup = useMemo(() => {
    return votes?.reduce((acc, vote) => {
      acc.add(vote.questionUid);
      return acc;
    }, new Set());
  }, [votes]);

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
                canModerate={isOrganizer}
                canVote={isAuthenticated}
                refresh={refresh}
                voted={questionLookup?.has(question.uid) ?? false}
                supervotes={supervotes}
                supervoted={supervoted?.has(question.uid) ?? false}
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
