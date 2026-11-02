import type { Event } from "../types.ts";

export function toEvent(data: Event) {
  return {
    ...data,
    start: new Date(data.start),
    end: new Date(data.end),
    questions: data.questions.map((question) => ({
      ...question,
      createdAt: new Date(question.createdAt),
      answeredAt: question.answeredAt
        ? new Date(question.answeredAt)
        : undefined,
    })),
  };
}
