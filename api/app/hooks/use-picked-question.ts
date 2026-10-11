import { useCallback, useMemo, useState } from "react";
import type { Question } from "../types.ts";

const STORAGE_KEY = "meerkat:celebrated-questions";

const readCelebrated = (): Set<string> => {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    return new Set(stored ? JSON.parse(stored) as string[] : []);
  } catch {
    return new Set();
  }
};

const writeCelebrated = (uids: Set<string>) => {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify([...uids]));
  } catch {
    // Private mode or blocked storage: the celebration may show again on
    // reload, which is harmless.
  }
};

/**
 * The current user's question that is being answered right now and hasn't
 * been celebrated yet. Celebrated question uids are remembered in
 * localStorage so the celebration shows once per question, even across
 * reloads.
 */
export function usePickedQuestion(
  questions: Question[] | undefined,
  userId: string | undefined,
) {
  // Empty during SSR, where localStorage doesn't exist. Questions load
  // client-side, so nothing is picked before hydration either way.
  const [celebrated, setCelebrated] = useState(readCelebrated);

  const picked = useMemo(() => {
    if (!userId) {
      return undefined;
    }
    return questions?.find((question) =>
      question.user?.id === userId &&
      question.selectedAt &&
      !question.answeredAt &&
      !celebrated.has(question.uid)
    );
  }, [questions, userId, celebrated]);

  const dismiss = useCallback(() => {
    if (!picked) {
      return;
    }
    const next = new Set(celebrated).add(picked.uid);
    writeCelebrated(next);
    setCelebrated(next);
  }, [picked, celebrated]);

  return { picked, dismiss };
}
