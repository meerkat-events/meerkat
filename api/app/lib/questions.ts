type Answerable = { selectedAt?: Date | string | undefined; answeredAt?: unknown };

/** Selected and not answered yet. */
export const isAnswering = (question: Answerable) =>
  !question.answeredAt && !!question.selectedAt;

/**
 * Splits off the question the speaker is answering right now, keeping the
 * others in their order. Selecting answers the previous selection, but two
 * concurrent selects can leave two questions answering; like the server's
 * getSelectedQuestion, the latest selected one is on stage.
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

// selectedAt arrives as an ISO string in JSON, whatever its declared type.
function selectedTime(question: Answerable) {
  return new Date(question.selectedAt!).getTime();
}
