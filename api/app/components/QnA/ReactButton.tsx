import { type Ref, useEffect, useRef, useState } from "react";
import { IconButton } from "@chakra-ui/react";
import { LuChevronLeft } from "react-icons/lu";
import { REACTION_LABELS, type ReactionEmoji } from "../../../reactions.ts";
import { HeartIcon } from "./HeartIcon.tsx";
import { ReactionGlyph } from "./ReactionGlyph.tsx";
import { toaster } from "../ui/toaster.tsx";

/** Reactions revealed next to the heart, nearest the heart first. */
const MORE_REACTIONS: ReactionEmoji[] = [
  "laugh",
  "fire",
  "star-struck",
  "clap",
];
/** How long the bar stays out after the last interaction. */
const HIDE_AFTER_MS = 4000;
/** Delay between reactions sliding in, nearest the heart first. */
const STAGGER_MS = 30;

export type ReactionOrigin = { x: number; y: number };

export type ReactButtonProps = {
  ref?: Ref<HTMLButtonElement>;
  disabled: boolean;
  onReact: (emoji: ReactionEmoji, origin: ReactionOrigin) => void;
};

/**
 * Floating bubble holding the heart and a small arrow. A tap on the heart
 * sends a heart; the arrow slides out a bar with the other reactions between
 * itself and the heart, and flips to point back in. The bar tucks away again
 * a few seconds after the last interaction, on a tap outside it or on Escape.
 */
export function ReactButton({ ref, disabled, onReact }: ReactButtonProps) {
  const [open, setOpen] = useState(false);
  // A disabled button shows no bar.
  if (disabled && open) setOpen(false);
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
    // The bar slides out where toasts sit (see app.css), so it clears them.
    toaster.dismiss();
    setOpen(true);
    scheduleHide();
  };

  return (
    <div className="reaction-picker" ref={containerRef}>
      <IconButton
        ref={ref}
        disabled={disabled}
        onClick={react("heart")}
        // Sized to match the send button below it
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
          // A full-height tap target around the small arrow; the bubble
          // clips anything that reaches outside it
          w="44px"
          h="50px"
          minW="44px"
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
              style={{
                transitionDelay: open ? `${index * STAGGER_MS}ms` : undefined,
              }}
              onClick={react(emoji)}
              variant="plain"
              w="44px"
              h="44px"
              minW="44px"
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
