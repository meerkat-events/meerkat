import type { Question } from "./types.ts";

const DATE_FIELDS: (keyof Question)[] = [
  "createdAt",
  "answeredAt",
  "selectedAt",
];

function parseDates(question: Record<string, unknown>): Question {
  const result = { ...question };
  for (const field of DATE_FIELDS) {
    const value = result[field];
    if (typeof value === "string") {
      result[field] = new Date(value);
    }
  }
  return result as unknown as Question;
}

export function parseQuestions(
  questions: Record<string, unknown>[],
): Question[] {
  return questions.map(parseDates);
}

export class FetchError extends Error {
  status: number;
  statusText: string;
  body: string | undefined;

  constructor(status: number, statusText: string, body?: string) {
    const message = body
      ? `Fetch error ${status}: ${body}`
      : `Fetch error ${status}: ${statusText}`;
    super(message);
    this.name = "FetchError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

export function createFetcher(apiUrl: string) {
  return async (endpoint: string) => {
    const res = await fetch(`${apiUrl}${endpoint}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      let body: string | undefined;
      try {
        body = await res.text();
      } catch {}
      throw new FetchError(res.status, res.statusText, body);
    }
    return res.json();
  };
}
