import { type Ref, useEffect, useRef, useState } from "react";
import { IconButton } from "@chakra-ui/react";
import { REACTION_LABELS, type ReactionEmoji } from "../../../reactions.ts";
import { HeartIcon } from "./HeartIcon.tsx";
import { ReactionGlyph } from "./ReactionGlyph.tsx";

/** Reactions revealed next to the heart, nearest the heart first. */
const MORE_REACTIONS: ReactionEmoji[] = ["fire", "star-struck", "clap"];
/** How long the bar stays out after the last reaction. */
const HIDE_AFTER_MS = 4000;

export type ReactionOrigin = { x: number; y: number };

export type ReactButtonProps = {
  ref?: Ref<HTMLButtonElement>;
  disabled: boolean;
  onReact: (emoji: ReactionEmoji, origin: ReactionOrigin) => void;
};

/**
 * Floating heart bubble. A tap sends a heart and slides out a bar with the
 * other reactions; the bar tucks away again a few seconds after the last one.
 */
export function ReactButton({ ref, disabled, onReact }: ReactButtonProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const close = () => {
    clearTimeout(hideTimer.current);
    setOpen(false);
  };

  const scheduleHide = () => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(function hide() {
      // Keyboard users moving through the bar keep it open.
      const focused = document.activeElement;
      if (
        focused && containerRef.current?.contains(focused) &&
        focused.matches(":focus-visible")
      ) {
        hideTimer.current = setTimeout(hide, HIDE_AFTER_MS);
        return;
      }
      close();
    }, HIDE_AFTER_MS);
  };

  useEffect(() => {
    const timer = hideTimer;
    return () => clearTimeout(timer.current);
  }, []);

  // Tuck the bar away on a tap outside it or on Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const react =
    (emoji: ReactionEmoji) => (event: React.MouseEvent<HTMLButtonElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      onReact(emoji, {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
      setOpen(true);
      scheduleHide();
    };

  return (
    <div className="reaction-picker" ref={containerRef}>
      <IconButton
        ref={ref}
        disabled={disabled}
        onClick={react("heart")}
        // Floating bubble, sized to match the send button below it
        variant="plain"
        size="lg"
        w="50px"
        h="50px"
        borderRadius="full"
        bg="bg.panel"
        boxShadow="0 8px 16px color-mix(in srgb, var(--chakra-colors-brand-solid) 35%, transparent), 0 0 1px color-mix(in srgb, var(--chakra-colors-brand-solid) 60%, transparent)"
        aria-label="React with Heart"
        type="button"
      >
        <div className={disabled ? undefined : "heart-pulsate"}>
          <HeartIcon />
        </div>
      </IconButton>
      {open && !disabled && (
        <div className="reaction-bar" role="group" aria-label="More reactions">
          {MORE_REACTIONS.map((emoji, index) => (
            <IconButton
              key={emoji}
              className="reaction-bar-item"
              style={{ animationDelay: `${index * 30}ms` }}
              onClick={react(emoji)}
              variant="plain"
              w="40px"
              h="40px"
              minW="40px"
              borderRadius="full"
              aria-label={`React with ${REACTION_LABELS[emoji]}`}
              type="button"
            >
              <ReactionGlyph emoji={emoji} />
            </IconButton>
          ))}
        </div>
      )}
    </div>
  );
}
