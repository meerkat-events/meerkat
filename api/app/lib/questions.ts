type Answerable = { selectedAt?: Date | string | undefined; answeredAt?: unknown };

/** Selected and not answered yet. */
export const isAnswering = (question: Answerable) =>
  !question.answeredAt && !!question.selectedAt;

/**
 * Splits off the question the speaker is answering right now, keeping the
 * others in their order. Selecting answers the previous selection, but two
 * concurrent selects can leave two questions answering; the latest selected
 * one is on stage.
 */
export function splitAnswering<Q extends Answerable>(questions: Q[]) {
  let answering: Q | undefined;
  for (const question of questions) {
    if (!isAnswering(question)) continue;
    if (!answering || selectedTime(question) > selectedTime(answering)) {
      answering = question;
    }
  }
  const others = questions.filter((question) => question !== answering);
  return { answering, others };
}

type QuestionListState = {
  /** The sort to fetch is known (from the URL, or the device's storage). */
  isSortKnown: boolean;
  /** The browser doesn't know yet whether there is a session. */
  isWaitingForSession: boolean;
  /** The first list for the current key hasn't arrived. */
  isFetching: boolean;
};

/**
 * Whether the Q&A page's question list is still loading. Without `?sort=`
 * the sort comes from the device's storage, which neither the server render
 * nor hydration reads, so nothing is fetched yet; the list still counts as
 * loading, or the server would render "No questions, yet" where the
 * hydrating browser renders "Loading..." (React #418).
 */
export function isQuestionListLoading(
  { isSortKnown, isWaitingForSession, isFetching }: QuestionListState,
) {
  return !isSortKnown || isWaitingForSession || isFetching;
}

// selectedAt is an ISO string in JSON, or a Date once parsed (lib/event.ts).
function selectedTime(question: Answerable) {
  return new Date(question.selectedAt!).getTime();
}
