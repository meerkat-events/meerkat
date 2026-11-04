import { type PointerEvent, useEffect, useRef, useState } from "react";

// Movement (px) before deciding whether the gesture is a swipe or a scroll.
const SLOP = 8;
// How far past the open position the card can be pulled before it stops.
const OVERSHOOT = 24;

/**
 * Swipe an element right to reveal actions underneath it, like a mail app.
 * Letting go past halfway leaves it open at `width`; swiping back, tapping
 * outside, or calling `close` shuts it. Vertical drags are left to the browser
 * so the list still scrolls.
 */
export function useSwipeReveal({ width, enabled }: {
  width: number;
  enabled: boolean;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const [open, setOpen] = useState(false);
  // Shut as soon as swiping no longer applies (e.g. the question was answered).
  const isOpen = open && enabled;
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const gesture = useRef<
    { id: number; x: number; y: number; base: number; horizontal?: boolean } | null
  >(null);

  const clamp = (value: number) =>
    Math.min(Math.max(value, 0), width + OVERSHOOT);

  const close = () => setOpen(false);

  // Close when the moderator taps anywhere else.
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: globalThis.PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isOpen]);

  // Drop a swipe in progress when swiping stops applying mid-drag (e.g.
  // another moderator answered the question): the handlers are removed, so
  // its pointerup would never arrive.
  const [wasEnabled, setWasEnabled] = useState(enabled);
  if (enabled !== wasEnabled) {
    setWasEnabled(enabled);
    if (!enabled) {
      setDragOffset(null);
      setOpen(false);
    }
  }
  useEffect(() => {
    if (!enabled) gesture.current = null;
  }, [enabled]);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // React bubbles events from portalled children (the options menu, the
    // supervote prompt) to the element; dragging inside them is no swipe.
    if (!event.currentTarget.contains(event.target as Node)) return;
    // Ignore a second finger while one is already swiping.
    if (gesture.current) return;
    gesture.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      base: isOpen ? width : 0,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;

    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;

    if (current.horizontal === undefined) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
      if (Math.abs(dy) >= Math.abs(dx)) {
        gesture.current = null;
        return;
      }
      current.horizontal = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    setDragOffset(clamp(current.base + dx));
  };

  const finish = (event: PointerEvent<HTMLElement>, cancelled: boolean) => {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    gesture.current = null;
    if (!current.horizontal) return;

    setDragOffset(null);
    if (cancelled) return;
    setOpen(clamp(current.base + event.clientX - current.x) > width / 2);
  };

  return {
    ref,
    offset: dragOffset ?? (isOpen ? width : 0),
    isDragging: dragOffset !== null,
    isOpen,
    close,
    handlers: enabled
      ? {
        onPointerDown,
        onPointerMove,
        onPointerUp: (event: PointerEvent<HTMLElement>) =>
          finish(event, false),
        onPointerCancel: (event: PointerEvent<HTMLElement>) =>
          finish(event, true),
        // The browser can take the pointer back mid-swipe (e.g. to scroll).
        onLostPointerCapture: (event: PointerEvent<HTMLElement>) =>
          finish(event, true),
      }
      : {},
  };
}
