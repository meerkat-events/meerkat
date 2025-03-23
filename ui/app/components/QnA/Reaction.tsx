import { useCallback, useEffect, useRef } from "react";

interface ReactionProps {
  uid: string;
  icon: JSX.Element;
  setReactions: React.Dispatch<React.SetStateAction<{ uid: string }[]>>;
}

export function Reaction({ uid, icon, setReactions }: ReactionProps) {
  const reactionRef = useRef<HTMLDivElement | null>(null);

  const removeReaction = useCallback((uid: string) => {
    setReactions((prevReactions) => {
      return prevReactions.filter((reaction) => reaction.uid !== uid);
    });
  }, [uid]);

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

  // "Random" starting position
  const right = ((getTimestamp(uid) % 100) / 100) * 2 + 5;
  return (
    <div className="reaction" ref={reactionRef} style={{ right: `${right}%` }}>
      {icon}
    </div>
  );
}

function getTimestamp(uid: string) {
  const timestampHex = uid.replace(/-/g, "").slice(0, 12);
  return parseInt(timestampHex, 16);
}
