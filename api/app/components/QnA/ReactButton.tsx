import { type Ref, useEffect, useRef, useState } from "react";
import { IconButton } from "@chakra-ui/react";
import { LuChevronLeft } from "react-icons/lu";
import { REACTION_LABELS, type ReactionEmoji } from "../../../reactions.ts";
import { HeartIcon } from "./HeartIcon.tsx";
import { ReactionGlyph } from "./ReactionGlyph.tsx";

/** Reactions revealed next to the heart, nearest the heart first. */
const MORE_REACTIONS: ReactionEmoji[] = [
  "laugh",
  "fire",
  "star-struck",
  "clap",
];
/** How long the bar stays out after the last reaction. */
const HIDE_AFTER_MS = 4000;

export type ReactionOrigin = { x: number; y: number };

export type ReactButtonProps = {
  ref?: Ref<HTMLButtonElement>;
  disabled: boolean;
  onReact: (emoji: ReactionEmoji, origin: ReactionOrigin) => void;
};

/**
 * Floating heart bubble. A tap sends a heart; the small arrow beside it slides
 * out a bar with the other reactions, which tucks away again a few seconds
 * after the last interaction.
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
      if (open) scheduleHide();
    };

  const toggle = () => {
    if (open) {
      close();
      return;
    }
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
        aria-label="React with Heart"
        type="button"
      >
        <div className={disabled ? undefined : "heart-pulsate"}>
          <HeartIcon />
        </div>
      </IconButton>
      {/* The arrow rides the bubble's left edge as it opens, then flips to
          point back in towards the heart. */}
      <div className="reaction-bar" data-open={open || undefined}>
        <IconButton
          className="reaction-toggle"
          disabled={disabled}
          onClick={toggle}
          variant="plain"
          w="28px"
          h="28px"
          minW="28px"
          borderRadius="full"
          color="fg.muted"
          aria-label={open ? "Hide more reactions" : "Show more reactions"}
          aria-expanded={open}
          type="button"
        >
          <LuChevronLeft />
        </IconButton>
        <div
          className="reaction-bar-items"
          role="group"
          aria-label="More reactions"
          inert={!open || disabled}
        >
          {MORE_REACTIONS.map((emoji, index) => (
            <IconButton
              key={emoji}
              className="reaction-bar-item"
              style={{ transitionDelay: open ? `${index * 30}ms` : undefined }}
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
      </div>
    </div>
  );
}
