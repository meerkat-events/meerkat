import { useEffect, useRef } from "react";
import { CloseButton, Portal } from "@chakra-ui/react";
import { FiZap } from "react-icons/fi";
import { MeerkatMascot } from "./MeerkatMascot.tsx";
import "./QuestionPicked.css";

const CONFETTI_COLORS = [
  "var(--chakra-colors-brand-solid)",
  "var(--chakra-colors-brand-300)",
  "#FF85A6",
  "#F6B613",
  "#74ACDF",
  "#FFFFFF",
];

// Four-point star centred on the origin.
const SPARKLE = "M0-6L1.5-1.5L6 0L1.5 1.5L0 6L-1.5 1.5L-6 0L-1.5-1.5Z";

// Randomized once per page load; the pattern doesn't need to differ between
// celebrations.
const CONFETTI = Array.from({ length: 60 }, (_, i) => ({
  left: `${Math.random() * 100}%`,
  background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  animationDuration: `${1.6 + Math.random() * 1.6}s`,
  animationDelay: `${Math.random() * 0.5}s`,
  round: i % 3 === 0,
}));

export type QuestionPickedProps = {
  /**
   * Called on tap, the close button or Escape. `supervoteFrom` is where the
   * supervote icon sat, so a follow-up animation can fly it from there.
   */
  onDismiss: (supervoteFrom?: DOMRect) => void;
  /**
   * Vote multiplier earned for the asker's next upvote, e.g. 3. Omitted until
   * the backend awards supervotes, so the reward row stays hidden.
   */
  supervote?: number | undefined;
};

/**
 * Full-screen celebration shown to the asker when an organizer selects their
 * question for answering. It stays until dismissed (tap, close button or
 * Escape): the asker may be busy listening to the answer.
 */
export function QuestionPicked(
  { onDismiss, supervote }: QuestionPickedProps,
) {
  const supervoteIconRef = useRef<HTMLDivElement>(null);
  const dismissRef = useRef(() => {});
  dismissRef.current = () =>
    onDismiss(supervoteIconRef.current?.getBoundingClientRect());

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dismissRef.current();
      }
    };
    globalThis.addEventListener("keydown", onKeyDown);
    return () => globalThis.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Portal>
      <div
        className="question-picked"
        role="alertdialog"
        aria-labelledby="question-picked-title"
        aria-describedby="question-picked-description"
        onClick={() => dismissRef.current()}
      >
        <div className="question-picked-confetti" aria-hidden="true">
          {CONFETTI.map(({ round, ...style }, i) => (
            <span
              key={i}
              className={round ? "round" : undefined}
              style={style}
            />
          ))}
        </div>
        <div className="question-picked-card">
          <CloseButton
            className="question-picked-close"
            size="sm"
            aria-label="Close"
          />
          <div className="question-picked-medal">
            <div className="question-picked-rays" />
            <div className="question-picked-disc">
              <MeerkatMascot className="question-picked-meerkat" pose="clever" />
            </div>
            <svg
              className="question-picked-sparkles"
              viewBox="0 0 40 40"
              aria-hidden="true"
            >
              <g transform="translate(14 22) scale(1.1)">
                <path d={SPARKLE} />
              </g>
              <g transform="translate(28 10) scale(.8)">
                <path d={SPARKLE} />
              </g>
              <g transform="translate(33 27) scale(.55)">
                <path d={SPARKLE} />
              </g>
            </svg>
          </div>
          <h2 id="question-picked-title" className="question-picked-title">
            Good question!
          </h2>
          <p
            id="question-picked-description"
            className="question-picked-description"
          >
            Your question is being answered right now.
          </p>
          {supervote && (
            <div className="question-picked-supervote">
              <div
                ref={supervoteIconRef}
                className="question-picked-supervote-icon"
              >
                <FiZap />
              </div>
              <div>
                <div className="question-picked-supervote-title">
                  Supervote earned
                </div>
                <div className="question-picked-supervote-description">
                  Your next upvote counts x{supervote}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
