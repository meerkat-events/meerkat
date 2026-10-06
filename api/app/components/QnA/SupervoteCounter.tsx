import type { Ref } from "react";
import { FiZap } from "react-icons/fi";
import "./Supervote.css";

export type SupervoteCounterProps = {
  count: number;
  ref?: Ref<HTMLButtonElement>;
  /** Opens the supervote explainer. */
  onClick: () => void;
  /** Shows a dot inviting the user to find out what supervotes are. */
  isNew?: boolean;
};

/**
 * Header pill with the number of supervotes the user can spend; dimmed at 0.
 * Bumps whenever the count changes (the key restarts the animation).
 */
export function SupervoteCounter(
  { count, ref, onClick, isNew }: SupervoteCounterProps,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={`supervote-counter${count === 0 ? " empty" : ""}`}
      onClick={onClick}
      aria-label={`${count} ${
        count === 1 ? "supervote" : "supervotes"
      }. What are supervotes?`}
    >
      <span key={count} className="supervote-counter-bump">
        <FiZap className="supervote-counter-icon" aria-hidden="true" />
        {count}
      </span>
      {isNew && <span className="supervote-counter-dot" aria-hidden="true" />}
    </button>
  );
}
