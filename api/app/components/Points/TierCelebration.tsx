import { useEffect, useRef, useState } from "react";
import { CloseButton, Portal } from "@chakra-ui/react";
import { MeerkatMascot } from "../QnA/MeerkatMascot.tsx";
import type { TierPromotion } from "../../hooks/use-tier-promotion.ts";
import { tierLabel, tierPaletteStyle } from "./tier.ts";
import { useModalOverlay } from "../../hooks/use-modal-overlay.ts";
import { tapTargetStyles } from "../../theme/index.ts";
// Same overlay, card, rays, confetti, sparkles and mascot as the
// question-picked celebration; TierCelebration.css recolors them in the
// tier's palette.
import "../QnA/QuestionPicked.css";
import "./TierCelebration.css";

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

const GREETING_KEY = "meerkat:tier-greeting";

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

export type TierCelebrationProps = {
  promotion: TierPromotion;
  /** Called on tap, the close button or Escape. */
  onDismiss: () => void;
};

/**
 * Full-screen celebration when the user moves into a better percentile tier,
 * in the style of the question-picked celebration. It stays until dismissed.
 */
export function TierCelebration({ promotion, onDismiss }: TierCelebrationProps) {
  const { from, to } = promotion;
  // Picked once per celebration
  const [greeting] = useState(nextGreeting);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  const [overlay, setOverlay] = useState<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useModalOverlay(overlay, closeRef);

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
        ref={setOverlay}
        className="question-picked tier-celebration"
        style={tierPaletteStyle(to)}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="tier-celebration-title"
        aria-describedby="tier-celebration-description"
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
          {/* Tapping anywhere closes the overlay; the button is for keyboards
              and screen readers, and gets focus when it opens */}
          <CloseButton
            ref={closeRef}
            className="question-picked-close"
            size="sm"
            aria-label="Close"
            {...tapTargetStyles}
          />
          <div className="question-picked-medal">
            <div className="question-picked-rays" />
            <div className="question-picked-disc">
              <MeerkatMascot className="question-picked-meerkat" />
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
          <p className="tier-celebration-greeting" aria-hidden="true">
            {greeting}
          </p>
          <h2 id="tier-celebration-title" className="question-picked-title">
            {from === null ? `You're in the ${tierLabel(to).toLowerCase()}!` : "Moving up!"}
          </h2>
          <p
            id="tier-celebration-description"
            className="question-picked-description"
          >
            {from === null
              ? "Of everyone asking and voting at this conference."
              : `From the ${tierLabel(from).toLowerCase()} to the ${tierLabel(to).toLowerCase()}.`}
          </p>
          <div className="question-picked-supervote tier-celebration-badge">
            <div className="question-picked-supervote-title">
              {tierLabel(to)}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
