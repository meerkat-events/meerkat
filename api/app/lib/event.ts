import type { Event, Question } from "../types.ts";

function toQuestion(question: Question) {
  return {
    ...question,
    createdAt: new Date(question.createdAt),
    answeredAt: question.answeredAt
      ? new Date(question.answeredAt)
      : undefined,
  };
}

export function toEvent(data: Event) {
  return {
    ...data,
    start: new Date(data.start),
    end: new Date(data.end),
    questions: data.questions.map(toQuestion),
    // Missing from servers older than high engagement mode, which a new
    // client can still reach while a deploy rolls out.
    recentlyAnswered: (data.recentlyAnswered ?? []).map(toQuestion),
  };
}
