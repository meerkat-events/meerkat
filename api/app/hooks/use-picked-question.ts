import { useCallback, useMemo, useState } from "react";
import { splitAnswering } from "../lib/questions.ts";
import { readStorage, writeStorage } from "../lib/storage.ts";
import type { Question } from "../types.ts";

const STORAGE_KEY = "meerkat:celebrated-questions";

const readCelebrated = (): Set<string> => {
  const stored = readStorage(STORAGE_KEY);
  if (!stored) {
    return new Set();
  }
  try {
    return new Set(JSON.parse(stored) as string[]);
  } catch {
    // Not JSON: start over
    return new Set();
  }
};

// Blocked storage: the celebration may show again on reload, which is
// harmless.
const writeCelebrated = (uids: Set<string>) =>
  writeStorage(STORAGE_KEY, JSON.stringify([...uids]));

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
    const { answering } = splitAnswering(questions ?? []);
    if (answering?.user?.id !== userId || celebrated.has(answering.uid)) {
      return undefined;
    }
    return answering;
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
