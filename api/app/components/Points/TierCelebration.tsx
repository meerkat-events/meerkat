import { useState } from "react";
import type { TierPromotion } from "../../hooks/use-tier-promotion.ts";
import { readStorage, writeStorage } from "../../lib/storage.ts";
import { tierLabel, tierPaletteStyle } from "./tier.ts";
import { Celebration } from "../Celebration/Celebration.tsx";
// Recolors the celebration in the tier's palette
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

/**
 * The next greeting in the cycle, remembered in localStorage. Blocked
 * storage always gives the first greeting, which is fine.
 */
function nextGreeting() {
  const index = Number(readStorage(GREETING_KEY)) || 0;
  writeStorage(GREETING_KEY, String((index + 1) % GREETINGS.length));
  return GREETINGS[index % GREETINGS.length]!;
}

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

  return (
    <Celebration
      confettiColors={CONFETTI_COLORS}
      className="tier-celebration"
      style={tierPaletteStyle(to)}
      titleId="tier-celebration-title"
      descriptionId="tier-celebration-description"
      onDismiss={onDismiss}
    >
      <p className="tier-celebration-greeting" aria-hidden="true">
        {greeting}
      </p>
      <h2 id="tier-celebration-title" className="celebration-title">
        {from === null ? `You're in the ${tierLabel(to).toLowerCase()}!` : "Moving up!"}
      </h2>
      <p
        id="tier-celebration-description"
        className="celebration-description"
      >
        {from === null
          ? "Of everyone asking and voting at this conference."
          : `From the ${tierLabel(from).toLowerCase()} to the ${tierLabel(to).toLowerCase()}.`}
      </p>
      <div className="celebration-reward tier-celebration-badge">
        <div className="celebration-reward-title">
          {tierLabel(to)}
        </div>
      </div>
    </Celebration>
  );
}
