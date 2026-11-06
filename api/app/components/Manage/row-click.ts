import type { MouseEvent } from "react";

// Controls inside a row do their own thing, menus included.
const CONTROLS = "a, button, input, select, textarea, label, [role=menu]";

/**
 * The `onClick` of a table row that opens something as a whole (give it the
 * `clickable` class too): `handler` runs for clicks anywhere on the row
 * except on a control inside it. The row itself isn't focusable, so a link
 * or button in it must do the same for keyboard and screen-reader users.
 */
export function rowClick(handler: () => void) {
  return (ev: MouseEvent<HTMLElement>) => {
    const row = ev.currentTarget;
    const target = ev.target;
    // Menus and dialogs opened from the row are portalled elsewhere in the
    // page, but React still bubbles their clicks through the row.
    if (!(target instanceof Element) || !row.contains(target)) return;
    const control = target.closest(CONTROLS);
    if (control && row.contains(control)) return;
    handler();
  };
}
