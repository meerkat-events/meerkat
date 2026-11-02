import { type UIEvent, useMemo } from "react";
import { splitAnswering } from "../../lib/questions.ts";
import { useListAnimation } from "../../hooks/use-list-animation.ts";
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

/** How far the list fades out beneath the pinned question, in pixels. */
const PINNED_FADE = 15;

/** Grows the fade as the list scrolls, so the first question starts out whole. */
function growPinnedFade(event: UIEvent<HTMLElement>) {
  const list = event.currentTarget;
  const fade = `${Math.min(Math.max(list.scrollTop, 0), PINNED_FADE)}px`;
  // Custom properties inherit, so each write restyles every card; skip the
  // writes once the fade is full.
  if (list.style.getPropertyValue("--pinned-fade") !== fade) {
    list.style.setProperty("--pinned-fade", fade);
  }
}

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
  const { answering, others } = useMemo(
    () => splitAnswering(questions ?? []),
    [questions],
  );
  // Questions slide to their new place when the order changes, and new ones
  // (or one that's been answered and leaves the pinned spot) slide down into
  // theirs. The pinned question fades in through CSS (.question-pinned).
  const listRef = useListAnimation<HTMLOListElement>(
    "slide-in",
    others.map((question) => question.uid).join(),
  );

  const renderQuestion = (question: QuestionType) => (
    <Question
      key={question.uid}
      question={question}
      canModerate={canModerate}
      canVote={canVote}
      refresh={refresh}
      voted={!!question.vote}
      supervotes={supervotes}
      supervoted={!!question.vote && question.vote.weight > 1}
      answering={question === answering}
      onAuthorSelect={question.user && onAuthorSelect
        ? () =>
          onAuthorSelect({
            id: question.user!.id,
            name: question.user!.name ?? question.user!.id,
          })
        : undefined}
    />
  );

  return (
    <>
      {questions?.length
        ? (
          <>
            {answering && (
              <ol className="question-pinned">{renderQuestion(answering)}</ol>
            )}
            <ol
              ref={listRef}
              className="question-list"
              onScroll={growPinnedFade}
            >
              {others.map(renderQuestion)}
            </ol>
          </>
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
