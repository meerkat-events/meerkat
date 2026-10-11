import { useEffect, useRef, useState } from "react";

type SupervoteEarningOptions = {
  /** The user's balance from `useSupervotes`; undefined until loaded. */
  available: number | undefined;
  /** Refetches the balance. */
  refresh: () => void;
  /** The question being answered right now, if any. */
  answeringQuestionUid: string | undefined;
  /** Whether the "your question was picked" celebration is open. */
  isCelebrating: boolean;
};

/**
 * The header counter's number and the "supervote earned" moment.
 *
 * The balance is refetched whenever the question being answered changes,
 * since selecting a question is what earns its author a supervote. When the
 * balance goes up while the user's celebration is open, they just earned
 * one: the counter keeps the old number, the celebration shows the reward,
 * and on dismiss a bolt flies from the celebration into the counter, which
 * then counts it. Any other change, such as a refund or a supervote earned
 * while the page was closed, simply updates the counter.
 */
export function useSupervoteEarning(
  { available, refresh, answeringQuestionUid, isCelebrating }:
    SupervoteEarningOptions,
) {
  const counterRef = useRef<HTMLButtonElement>(null);
  // Supervotes earned during the celebration that the counter doesn't show
  // yet: they land with the bolt.
  const [landing, setLanding] = useState(0);
  // Where the bolt takes off; set while it flies.
  const [flightFrom, setFlightFrom] = useState<DOMRect>();

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    if (answeringQuestionUid) {
      refreshRef.current();
    }
  }, [answeringQuestionUid]);

  const previousAvailableRef = useRef(available);
  useEffect(() => {
    const previous = previousAvailableRef.current;
    previousAvailableRef.current = available;
    if (previous === undefined || available === undefined) {
      return;
    }
    if (isCelebrating && available > previous) {
      setLanding((count) => count + available - previous);
    }
  }, [available, isCelebrating]);

  /** Call when the celebration closes, with where its supervote icon sat. */
  const onCelebrationDismiss = (iconRect: DOMRect | undefined) => {
    if (landing === 0) {
      return;
    }
    if (iconRect) {
      setFlightFrom(iconRect);
    } else {
      setLanding(0);
    }
  };

  const onFlightLand = () => {
    setFlightFrom(undefined);
    setLanding(0);
  };

  return {
    /** What the header counter shows. */
    count: Math.max(0, (available ?? 0) - landing),
    /** Whether the celebration should show the supervote just earned. */
    hasEarned: landing > 0,
    counterRef,
    flightFrom,
    flightTarget: () => counterRef.current?.getBoundingClientRect(),
    onCelebrationDismiss,
    onFlightLand,
  };
}
