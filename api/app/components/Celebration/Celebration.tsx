import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { CloseButton, Portal } from "@chakra-ui/react";
import { MeerkatMascot } from "../QnA/MeerkatMascot.tsx";
import { useModalOverlay } from "../../hooks/use-modal-overlay.ts";
import { tapTargetStyles } from "../../theme/index.ts";
import "./Celebration.css";

// Four-point star centred on the origin.
const SPARKLE = "M0-6L1.5-1.5L6 0L1.5 1.5L0 6L-1.5 1.5L-6 0L-1.5-1.5Z";

// Randomized once per page load; the pattern doesn't need to differ between
// celebrations. Each celebration colors the pieces with its own palette.
const CONFETTI = Array.from({ length: 60 }, (_, i) => ({
  left: `${Math.random() * 100}%`,
  animationDuration: `${1.6 + Math.random() * 1.6}s`,
  animationDelay: `${Math.random() * 0.5}s`,
  round: i % 3 === 0,
}));

export type CelebrationProps = {
  /** Cycled through the confetti pieces. */
  confettiColors: string[];
  /** Added to the overlay's `celebration` class, to restyle it. */
  className?: string | undefined;
  style?: CSSProperties | undefined;
  /** Id of the heading among `children`. */
  titleId: string;
  /** Id of the description among `children`. */
  descriptionId: string;
  /** Called on tap, the close button or Escape. */
  onDismiss: () => void;
  /** The text below the medal. */
  children: ReactNode;
};

/**
 * Full-screen celebration overlay: confetti and a card with the meerkat in a
 * medal above `children`. It stays until dismissed (tap, close button or
 * Escape), and behaves like a modal dialog meanwhile.
 */
export function Celebration(
  {
    confettiColors,
    className,
    style,
    titleId,
    descriptionId,
    onDismiss,
    children,
  }: CelebrationProps,
) {
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
        className={className ? `celebration ${className}` : "celebration"}
        style={style}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={() => dismissRef.current()}
      >
        <div className="celebration-confetti" aria-hidden="true">
          {CONFETTI.map(({ round, ...pieceStyle }, i) => (
            <span
              key={i}
              className={round ? "round" : undefined}
              style={{
                ...pieceStyle,
                background: confettiColors[i % confettiColors.length],
              }}
            />
          ))}
        </div>
        <div className="celebration-card">
          {/* Tapping anywhere closes the overlay; the button is for keyboards
              and screen readers, and gets focus when it opens */}
          <CloseButton
            ref={closeRef}
            className="celebration-close"
            size="sm"
            aria-label="Close"
            {...tapTargetStyles}
          />
          <Medal />
          {children}
        </div>
      </div>
    </Portal>
  );
}

/** The meerkat in a disc, with spinning rays behind and sparkles beside. */
function Medal() {
  return (
    <div className="celebration-medal">
      <div className="celebration-rays" />
      <div className="celebration-disc">
        <MeerkatMascot className="celebration-meerkat" />
      </div>
      <svg
        className="celebration-sparkles"
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
  );
}
