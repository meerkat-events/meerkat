import { useEffect, useRef } from "react";
import { Portal } from "@chakra-ui/react";
import { FiZap } from "react-icons/fi";
import "./Supervote.css";

const SIZE = 36;

export type SupervoteFlightProps = {
  /** Where the bolt takes off, e.g. the celebration's supervote icon. */
  from: DOMRect;
  /**
   * Where it lands, e.g. the header counter. Read when the flight starts, so
   * an element that mounts alongside the flight can be the target.
   */
  to: () => DOMRect | undefined;
  onLand: () => void;
};

/** A gold bolt that arcs from `from` to `to`, then calls `onLand`. */
export function SupervoteFlight({ from, to: getTo, onLand }: SupervoteFlightProps) {
  const boltRef = useRef<HTMLDivElement>(null);
  const onLandRef = useRef(onLand);
  onLandRef.current = onLand;
  const getToRef = useRef(getTo);
  getToRef.current = getTo;

  useEffect(() => {
    const bolt = boltRef.current;
    const to = getToRef.current();
    const reduceMotion = globalThis.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!bolt || !to || reduceMotion) {
      onLandRef.current();
      return;
    }

    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    // Lift up and out first, then swoop into the counter.
    const animation = bolt.animate([
      { transform: "translate(0, 0) scale(1) rotate(0)" },
      {
        transform: `translate(${dx * 0.25}px, ${dy * 0.35 - 60}px) scale(1.45) rotate(-20deg)`,
        offset: 0.4,
      },
      {
        transform: `translate(${dx}px, ${dy}px) scale(0.45) rotate(15deg)`,
        opacity: 0.9,
      },
    ], { duration: 900, easing: "cubic-bezier(0.5, 0, 0.3, 1)", fill: "forwards" });
    animation.onfinish = () => onLandRef.current();
    return () => animation.cancel();
  }, [from]);

  return (
    <Portal>
      <div
        ref={boltRef}
        className="supervote-flight"
        aria-hidden="true"
        style={{
          left: from.left + from.width / 2 - SIZE / 2,
          top: from.top + from.height / 2 - SIZE / 2,
          width: SIZE,
          height: SIZE,
        }}
      >
        <FiZap />
      </div>
    </Portal>
  );
}
