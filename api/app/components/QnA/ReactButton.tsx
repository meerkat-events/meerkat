import { type Ref, useEffect, useRef, useState } from "react";
import { IconButton } from "@chakra-ui/react";
import { REACTION_LABELS, type ReactionEmoji } from "../../../reactions.ts";
import { HeartIcon } from "./HeartIcon.tsx";
import { ReactionGlyph } from "./ReactionGlyph.tsx";

/** Reactions revealed next to the heart, nearest the heart first. */
const MORE_REACTIONS: ReactionEmoji[] = ["fire", "star-struck", "clap"];
/** How long the bar stays out after the last reaction. */
const HIDE_AFTER_MS = 4000;
/** How long the bar stays out after the mouse leaves it. */
const HIDE_AFTER_LEAVE_MS = 300;

export type ReactionOrigin = { x: number; y: number };

export type ReactButtonProps = {
  ref?: Ref<HTMLButtonElement>;
  disabled: boolean;
  onReact: (emoji: ReactionEmoji, origin: ReactionOrigin) => void;
};

/**
 * Floating heart bubble with a bar of the other reactions beside it. With a
 * mouse, hovering the bubble slides the bar out and a click on the heart
 * sends a heart. On touch, the first tap on the heart slides the bar out;
 * then a tap sends a heart or any other reaction. The bar tucks away again a
 * few seconds after the last reaction, or soon after the mouse leaves it.
 */
export function ReactButton({ ref, disabled, onReact }: ReactButtonProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const isHovered = useRef(false);

  const close = () => {
    clearTimeout(hideTimer.current);
    setOpen(false);
  };

  const scheduleHide = () => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(function hide() {
      // Keyboard users moving through the bar, and a mouse resting on it,
      // keep it open.
      const focused = document.activeElement;
      if (
        isHovered.current ||
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

  const show = () => {
    setOpen(true);
    scheduleHide();
  };

  // Touch has no hover, so only a mouse opens the bar by pointing at it.
  const onPointerEnter = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse" || disabled) return;
    isHovered.current = true;
    show();
  };

  const onPointerLeave = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    isHovered.current = false;
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(close, HIDE_AFTER_LEAVE_MS);
  };

  return (
    <div
      className="reaction-picker"
      ref={containerRef}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <IconButton
        ref={ref}
        disabled={disabled}
        // Opens the bar first, so a heart is never sent by accident.
        onClick={open ? react("heart") : show}
        // Floating bubble above the question input
        variant="plain"
        size="lg"
        w="50px"
        h="50px"
        borderRadius="full"
        bg="bg.panel"
        boxShadow="floating"
        aria-label={open ? "React with Heart" : "Show reactions"}
        aria-expanded={open}
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
