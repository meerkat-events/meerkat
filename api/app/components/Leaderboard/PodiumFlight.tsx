import { useEffect, useRef } from "react";
import { Portal } from "@chakra-ui/react";
import { PodiumMeerkat } from "./PodiumMeerkat.tsx";
import { type PodiumBadge, podiumPaletteStyle } from "./podium.ts";
import "./Podium.css";

const SIZE = 56;

export type PodiumFlightProps = {
  badge: PodiumBadge;
  /** Where the meerkat takes off: the celebration's medal. */
  from: DOMRect;
  /** Where it lands: the header badge, read when the flight starts. */
  to: () => DOMRect | undefined;
  onLand: () => void;
};

/**
 * The podium meerkat arcing from the celebration into the header badge, like
 * the supervote bolt flying into its counter. Calls `onLand` at the end.
 */
export function PodiumFlight({ badge, from, to: getTo, onLand }: PodiumFlightProps) {
  const meerkatRef = useRef<HTMLDivElement>(null);
  const onLandRef = useRef(onLand);
  onLandRef.current = onLand;
  const getToRef = useRef(getTo);
  getToRef.current = getTo;

  useEffect(() => {
    const meerkat = meerkatRef.current;
    const to = getToRef.current();
    const reduceMotion = globalThis.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!meerkat || !to || reduceMotion) {
      onLandRef.current();
      return;
    }

    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const scale = to.width / SIZE;
    // Hop up first, then swoop into the header.
    const animation = meerkat.animate([
      { transform: "translate(0, 0) scale(1) rotate(0)" },
      {
        transform: `translate(${dx * 0.2}px, ${dy * 0.3 - 50}px) scale(1.2) rotate(-12deg)`,
        offset: 0.4,
      },
      {
        transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotate(0)`,
      },
    ], { duration: 950, easing: "cubic-bezier(0.5, 0, 0.3, 1)", fill: "forwards" });
    animation.onfinish = () => onLandRef.current();
    return () => animation.cancel();
  }, [from]);

  return (
    <Portal>
      <div
        ref={meerkatRef}
        className="podium-flight"
        aria-hidden="true"
        style={{
          left: from.left + from.width / 2 - SIZE / 2,
          top: from.top + from.height / 2 - SIZE / 2,
          width: SIZE,
          height: SIZE,
          ...podiumPaletteStyle(badge),
          backgroundColor: "var(--chakra-colors-color-palette-muted)",
          borderColor: "var(--chakra-colors-color-palette-solid)",
        }}
      >
        <PodiumMeerkat role={badge.role} />
      </div>
    </Portal>
  );
}
