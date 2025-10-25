import type { Event } from "~/types";

export function toEvent(data: Event) {
  return {
    ...data,
    start: new Date(data.start),
    end: new Date(data.end),
    url: new URL(`${import.meta.env.VITE_API_URL}/e/${data.uid}/qa`),
    questions: data.questions.map((question) => ({
      ...question,
      createdAt: new Date(question.createdAt),
      answeredAt: question.answeredAt
        ? new Date(question.answeredAt)
        : undefined,
    })),
  };
}
