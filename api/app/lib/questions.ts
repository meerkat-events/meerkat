type Answerable = { selectedAt?: unknown; answeredAt?: unknown };

/** The question the speaker is answering right now. */
export const isAnswering = (question: Answerable) =>
  !question.answeredAt && !!question.selectedAt;

/** Moves the question being answered to the top, whatever the sort order. */
export function pinAnswering<Q extends Answerable>(questions: Q[]) {
  return [
    ...questions.filter(isAnswering),
    ...questions.filter((question) => !isAnswering(question)),
  ];
}
