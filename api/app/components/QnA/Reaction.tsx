import { useCallback, useEffect, useRef } from "react";
import type { ReactionEmoji } from "../../../reactions.ts";
import { ReactionGlyph } from "./ReactionGlyph.tsx";

/** A reaction to animate, with the viewport point it floats up from. */
export type ReactionItem = {
  uid: string;
  emoji: ReactionEmoji;
  x: number;
  y: number;
};

interface ReactionProps {
  reaction: ReactionItem;
  setReactions: React.Dispatch<React.SetStateAction<ReactionItem[]>>;
}

export function Reaction({ reaction, setReactions }: ReactionProps) {
  const { uid, emoji, x, y } = reaction;
  const reactionRef = useRef<HTMLDivElement | null>(null);

  const removeReaction = useCallback((uid: string) => {
    setReactions((prevReactions) => {
      return prevReactions.filter((reaction) => reaction.uid !== uid);
    });
  }, [setReactions]);

  useEffect(() => {
    const reactionElement = reactionRef.current;
    // Remove reaction after animation ends
    const handleAnimationEnd = () => {
      removeReaction(uid);
    };

    reactionElement?.addEventListener("animationend", handleAnimationEnd);

    return () => {
      reactionElement?.removeEventListener("animationend", handleAnimationEnd);
    };
  }, [uid, removeReaction]);

  // "Random" starting position, up to 2% of the screen left of the button
  const nudge = ((getTimestamp(uid) % 100) / 100) * 2;
  return (
    <div
      className="reaction-heart"
      ref={reactionRef}
      style={{ left: `calc(${x}px - ${nudge}vw)`, top: y }}
    >
      <ReactionGlyph emoji={emoji} />
    </div>
  );
}

function getTimestamp(uid: string) {
  const timestampHex = uid.replace(/-/g, "").slice(0, 12);
  return parseInt(timestampHex, 16);
}
