import type { Question } from "../../types.ts";

/**
 * A question carries its moderation state on the API. `flaggedAt` and
 * `flagReason` come from automatic spam flagging: until that ships, questions
 * simply arrive without them and the spam state never appears.
 */
export type ModeratedQuestion = Question & {
  deletedAt?: string | Date | null;
  flaggedAt?: string | Date | null;
  flagReason?: string | null;
};

export type QuestionState = "open" | "answering" | "answered" | "hidden" | "spam";

/** Hidden wins over everything; a flagged question that is still up reads as spam. */
export function questionStates(q: ModeratedQuestion): QuestionState[] {
  const states: QuestionState[] = [];
  if (q.deletedAt) states.push("hidden");
  if (q.flaggedAt) states.push("spam");
  if (!q.deletedAt) {
    if (q.answeredAt) states.push("answered");
    else if (q.selectedAt) states.push("answering");
    else states.push("open");
  }
  return states;
}

export const FILTERS = [
  { value: "all", label: "All" },
  { value: "answered", label: "Answered" },
  { value: "hidden", label: "Hidden" },
  { value: "spam", label: "Spam" },
] as const;

export type Filter = (typeof FILTERS)[number]["value"];

export function matchesFilter(q: ModeratedQuestion, filter: Filter) {
  if (filter === "all") return true;
  return questionStates(q).includes(filter);
}

/**
 * Until automatic spam flagging ships there is nothing to design against, so
 * `?spam=preview` on a management page pretends a few questions were flagged.
 * It only changes what is displayed, and a chip in the header says so.
 */
const PREVIEW_KEY = "meerkat-manage-spam-preview";

export function spamPreviewOn(): boolean {
  if (typeof globalThis.location === "undefined") return false;
  try {
    const param = new URLSearchParams(globalThis.location.search).get("spam");
    if (param === "preview") sessionStorage.setItem(PREVIEW_KEY, "1");
    if (param === "off") sessionStorage.removeItem(PREVIEW_KEY);
    return sessionStorage.getItem(PREVIEW_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearSpamPreview() {
  try {
    sessionStorage.removeItem(PREVIEW_KEY);
  } catch { /* ignore */ }
}

/** Marks a stable sample of questions, so the preview doesn't jump around. */
export function withSpamPreview<T extends ModeratedQuestion>(questions: T[]): T[] {
  if (!spamPreviewOn()) return questions;
  return questions.map((q, i) =>
    i % 4 === 1
      ? { ...q, flaggedAt: q.createdAt, flagReason: "Preview: looks like spam" }
      : q
  );
}
