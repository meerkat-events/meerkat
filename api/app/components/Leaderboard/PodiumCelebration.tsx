import { useEffect, useRef, useState } from "react";
import { CloseButton, Portal } from "@chakra-ui/react";
import { PodiumMeerkat } from "./PodiumMeerkat.tsx";
import {
  type PodiumBadge,
  podiumLabel,
  podiumPaletteStyle,
} from "./podium.ts";
// Same overlay, card, rays, confetti and sparkles as the question-picked
// celebration; Podium.css recolors them in the badge's palette.
import "../QnA/QuestionPicked.css";
import "./Podium.css";

const CONFETTI_COLORS = [
  "var(--chakra-colors-color-palette-solid)",
  "var(--chakra-colors-color-palette-emphasized)",
  "var(--chakra-colors-brand-solid)",
  "#F6B613",
  "#FF85A6",
  "#FFFFFF",
];

// Greetings above the heading, cycled so back-to-back celebrations differ.
// Meerkats keep in touch with chirps and greet each other nose to nose.
const GREETINGS = [
  "Chirp chirp!",
  "Boop!",
  "Woohoo!",
  "Congrats!",
  "Mob-tastic!",
  "Way to go!",
];

const GREETING_KEY = "meerkat:podium-greeting";

/** The next greeting in the cycle, remembered in localStorage. */
function nextGreeting() {
  try {
    const index = Number(globalThis.localStorage?.getItem(GREETING_KEY)) || 0;
    globalThis.localStorage?.setItem(
      GREETING_KEY,
      String((index + 1) % GREETINGS.length),
    );
    return GREETINGS[index % GREETINGS.length]!;
  } catch {
    // Blocked storage: always the first greeting, which is fine.
    return GREETINGS[0]!;
  }
}

// Four-point star centred on the origin.
const SPARKLE = "M0-6L1.5-1.5L6 0L1.5 1.5L0 6L-1.5 1.5L-6 0L-1.5-1.5Z";

// Randomized once per page load, like the question-picked confetti.
const CONFETTI = Array.from({ length: 60 }, (_, i) => ({
  left: `${Math.random() * 100}%`,
  background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  animationDuration: `${1.6 + Math.random() * 1.6}s`,
  animationDelay: `${Math.random() * 0.5}s`,
  round: i % 3 === 0,
}));

export type PodiumCelebrationProps = {
  /** The badge the user just earned. */
  badge: PodiumBadge;
  /** Their previous badge, when they moved up from another podium spot. */
  previous: PodiumBadge | undefined;
  /**
   * Called on tap, the close button or Escape, with where the meerkat sat so
   * it can fly into the header.
   */
  onDismiss: (meerkatFrom?: DOMRect) => void;
};

/**
 * Full-screen celebration when the user reaches the leaderboard podium or
 * moves up on it, in the style of the question-picked celebration. It stays
 * until dismissed.
 */
export function PodiumCelebration(
  { badge, previous, onDismiss }: PodiumCelebrationProps,
) {
  const discRef = useRef<HTMLDivElement>(null);
  // Picked once per celebration
  const [greeting] = useState(nextGreeting);
  const dismissRef = useRef(() => {});
  dismissRef.current = () =>
    onDismiss(discRef.current?.getBoundingClientRect());

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
        className="question-picked podium-celebration"
        style={podiumPaletteStyle(badge)}
        role="alertdialog"
        aria-labelledby="podium-celebration-title"
        aria-describedby={previous
          ? "podium-celebration-description"
          : undefined}
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
            <div ref={discRef} className="question-picked-disc">
              <PodiumMeerkat
                className="podium-celebration-meerkat"
                role={badge.role}
              />
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
          <p className="podium-celebration-greeting" aria-hidden="true">
            {greeting}
          </p>
          <h2 id="podium-celebration-title" className="question-picked-title">
            {previous ? "Moving up!" : `You're number ${badge.rank}!`}
          </h2>
          {previous && (
            <p
              id="podium-celebration-description"
              className="question-picked-description"
            >
              From {podiumLabel(previous)} to {podiumLabel(badge)}.
            </p>
          )}
          <div className="question-picked-supervote podium-celebration-badge">
            <div>
              <div className="question-picked-supervote-title">
                {badge.title}
              </div>
              <div className="question-picked-supervote-description">
                {badge.description}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
