import type { Event } from "../types.ts";
import { qa } from "../routing.ts";
import { appOrigin } from "./api-url.ts";

export function toEvent(data: Event) {
  return {
    ...data,
    start: new Date(data.start),
    end: new Date(data.end),
    url: new URL(qa(data.uid), appOrigin()),
    questions: data.questions.map((question) => ({
      ...question,
      createdAt: new Date(question.createdAt),
      answeredAt: question.answeredAt
        ? new Date(question.answeredAt)
        : undefined,
    })),
  };
}
