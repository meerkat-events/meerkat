import { useRef } from "react";
import { FiZap } from "react-icons/fi";
import { Celebration } from "../Celebration/Celebration.tsx";

const CONFETTI_COLORS = [
  "var(--chakra-colors-brand-solid)",
  "var(--chakra-colors-brand-300)",
  "#FF85A6",
  "#F6B613",
  "#74ACDF",
  "#FFFFFF",
];

export type QuestionPickedProps = {
  /**
   * Called on tap, the close button or Escape. `supervoteFrom` is where the
   * supervote icon sat, so a follow-up animation can fly it from there.
   */
  onDismiss: (supervoteFrom?: DOMRect) => void;
  /**
   * Set when the asker just earned a supervote: its weight, e.g. 3. Omitted
   * otherwise, which hides the reward row.
   */
  weight?: number | undefined;
};

/**
 * Full-screen celebration shown to the asker when an organizer selects their
 * question for answering. It stays until dismissed (tap, close button or
 * Escape): the asker may be busy listening to the answer.
 */
export function QuestionPicked(
  { onDismiss, weight }: QuestionPickedProps,
) {
  const supervoteIconRef = useRef<HTMLDivElement>(null);

  return (
    <Celebration
      confettiColors={CONFETTI_COLORS}
      titleId="question-picked-title"
      descriptionId="question-picked-description"
      onDismiss={() =>
        onDismiss(supervoteIconRef.current?.getBoundingClientRect())}
    >
      <h2 id="question-picked-title" className="celebration-title">
        Good question!
      </h2>
      <p
        id="question-picked-description"
        className="celebration-description"
      >
        Your question is being answered right now.
      </p>
      {weight && (
        <div className="celebration-reward">
          <div ref={supervoteIconRef} className="celebration-reward-icon">
            <FiZap />
          </div>
          <div>
            <div className="celebration-reward-title">
              Supervote earned
            </div>
            <div className="celebration-reward-description">
              Your next upvote counts x{weight}
            </div>
          </div>
        </div>
      )}
    </Celebration>
  );
}
