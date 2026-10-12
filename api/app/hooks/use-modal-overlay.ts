import { type RefObject, useEffect } from "react";

/**
 * Makes a custom full-screen overlay (a celebration) behave like a modal
 * dialog for keyboard and screen-reader users, as Chakra's Dialog does: while
 * it's open the rest of the page is inert, so focus and the virtual cursor
 * can't wander behind it; focus moves to `initialFocus`, and goes back to
 * where it was when the overlay closes.
 *
 * `overlay` is the element itself (from a callback ref), not a ref object:
 * Chakra's Portal can mount its content after the first render, and the
 * effect has to run once it exists.
 */
export function useModalOverlay(
  overlay: HTMLElement | null,
  initialFocus: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!overlay) return;

    const previousFocus = document.activeElement;
    // Everything at the top of the page except the overlay's own portal,
    // and nothing another overlay already made inert
    const background = [...document.body.children].filter((child) =>
      !child.contains(overlay) && !child.hasAttribute("inert")
    );
    for (const child of background) {
      child.setAttribute("inert", "");
    }
    initialFocus.current?.focus();

    return () => {
      for (const child of background) {
        child.removeAttribute("inert");
      }
      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus();
      }
    };
  }, [overlay, initialFocus]);
}
