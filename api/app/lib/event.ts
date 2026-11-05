import type { Event, Question } from "../types.ts";

/** A question with its timestamps parsed from the JSON's ISO strings. */
export type ParsedQuestion =
  & Omit<Question, "createdAt" | "answeredAt" | "selectedAt">
  & {
    createdAt: Date;
    answeredAt?: Date | undefined;
    selectedAt?: Date | undefined;
  };

/** An event with its dates and its questions' timestamps parsed. */
export type ParsedEvent =
  & Omit<Event, "start" | "end" | "questions" | "recentlyAnswered">
  & {
    start: Date;
    end: Date;
    questions: ParsedQuestion[];
    recentlyAnswered: ParsedQuestion[];
  };

function toQuestion(question: Question): ParsedQuestion {
  return {
    ...question,
    createdAt: new Date(question.createdAt),
    answeredAt: question.answeredAt
      ? new Date(question.answeredAt)
      : undefined,
    selectedAt: question.selectedAt
      ? new Date(question.selectedAt)
      : undefined,
  };
}

export function toEvent(data: Event): ParsedEvent {
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
