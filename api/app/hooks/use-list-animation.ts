import { useEffect, useLayoutEffect, useRef } from "react";

/** How a new item appears: sliding down into its place from one item's
 *  height above it, or fading in at its place. */
export type ListEnterAnimation = "slide-in" | "fade";

const DURATION_MS = 300;
const EASING = "ease-out";

/**
 * Animates a list's items when its items change (FLIP, on the Web Animations
 * API): every item that moved slides from where it was shown to its new
 * place, and a new item slides or fades in. A removed item just disappears;
 * the ones below it slide up into the gap.
 *
 * Put the returned ref on the list; its direct children are the items, and
 * the list must be their offsetParent (position: relative in its CSS), with
 * items that are positioned or flex items, so z-index applies to them.
 * `itemKeys` identifies the items in order (their uids joined), so the list
 * is measured only when they change. Items are told apart by their DOM node,
 * so their React keys must be stable. The items on the list's first render
 * appear without animating, and nothing animates for people who prefer
 * reduced motion.
 *
 * The hook takes care of what the animation needs from the list itself:
 * - It turns the list's scroll anchoring off. When a visible item moves up,
 *   React keeps that item's node and moves the others, so Chrome anchors on
 *   it and scrolls the list along with it, to the top for a long jump. iOS
 *   Safari doesn't anchor, so this keeps the scroll position everywhere.
 * - An item moving up passes over the ones moving down to make room for it,
 *   which would otherwise paint over it (they come later in the list). The
 *   hook raises it while it moves and marks it `data-rising`, so the list's
 *   CSS can also make it opaque when its items are see-through.
 */
export function useListAnimation<ListElement extends HTMLElement>(
  enter: ListEnterAnimation,
  itemKeys: string,
) {
  const listRef = useRef<ListElement>(null);
  // Where each item sat in the list after the last measurement, the list it
  // was in (a list that mounts again starts over) and the list's scroll
  // position as last seen by its scroll events.
  const previousTops = useRef(new WeakMap<Element, number>());
  const previousList = useRef<ListElement | null>(null);
  const lastScrollTop = useRef(0);
  const runningAnimations = useRef(new WeakMap<Element, Animation>());

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }
    const isFirstRender = list !== previousList.current;
    previousList.current = list;
    if (isFirstRender) {
      list.style.overflowAnchor = "none";
    }
    const reduceMotion = globalThis.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const running = runningAnimations.current;
    // A list that scrolls on its own may have just scrolled, before its
    // scroll event: the browser lowers scrollTop when the list gets shorter
    // (an item removed while scrolled to the bottom). The items didn't move
    // on screen by that much.
    const scrollShift = isFirstRender
      ? 0
      : list.scrollTop - lastScrollTop.current;
    lastScrollTop.current = list.scrollTop;

    for (const item of list.children) {
      if (!(item instanceof HTMLElement)) {
        continue;
      }
      // offsetTop ignores transforms and the list's scrolling: it's where the
      // item sits in the list, not where an animation currently shows it.
      const top = item.offsetTop;
      const previousTop = previousTops.current.get(item);
      previousTops.current.set(item, top);

      if (isFirstRender || reduceMotion) {
        continue;
      }
      if (previousTop === undefined) {
        startAnimation(running, item, enterKeyframes(enter));
        continue;
      }
      const moved = previousTop - top + scrollShift;
      // Under a pixel is no move: offsetTop is rounded, while scrollTop can
      // change by fractions on high-density screens. Let an animation that's
      // still running finish.
      if (Math.abs(moved) < 1) {
        continue;
      }
      // Start from where the item shows now, which includes how far a
      // running animation has carried it and how faded in it is.
      const shown = currentlyShown(running, item);
      const startOffset = moved + shown.translateY;
      const animation = startAnimation(running, item, [
        { transform: `translateY(${startOffset}px)`, opacity: shown.opacity },
        { transform: "none", opacity: 1 },
      ]);
      // Moving up on screen: it starts below its place. Not `moved`, which
      // ignores where an interrupted animation left it.
      if (startOffset > 0) {
        raiseWhileRunning(running, item, animation);
      }
    }
  }, [enter, itemKeys]);

  // Positions also change without a render: a resize, a rotation, a web font
  // that loads late. Measure again then, so the next change of items doesn't
  // animate those shifts. And follow the scroll position the user sets.
  useEffect(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }
    const measure = () => {
      for (const item of list.children) {
        previousTops.current.set(item, (item as HTMLElement).offsetTop);
      }
    };
    const followScroll = () => {
      lastScrollTop.current = list.scrollTop;
    };
    // The items too: a list with a fixed height (one that scrolls) keeps its
    // size when the text in its items wraps differently.
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(list);
    for (const item of list.children) {
      resizeObserver.observe(item);
    }
    list.addEventListener("scroll", followScroll, { passive: true });
    return () => {
      resizeObserver.disconnect();
      list.removeEventListener("scroll", followScroll);
    };
  }, [itemKeys]);

  return listRef;
}

/** Replaces the item's running animation, if any, with a new one. */
function startAnimation(
  running: WeakMap<Element, Animation>,
  item: HTMLElement,
  keyframes: Keyframe[],
) {
  running.get(item)?.cancel();
  // Raised only while moving up (raiseWhileRunning), not by an earlier move.
  lower(item);
  const animation = item.animate(keyframes, {
    duration: DURATION_MS,
    easing: EASING,
  });
  running.set(item, animation);
  return animation;
}

/**
 * Paints the item above its siblings, marked `data-rising`, until its
 * animation ends. A newer animation that replaced this one decides for
 * itself, so its raise isn't undone here.
 */
function raiseWhileRunning(
  running: WeakMap<Element, Animation>,
  item: HTMLElement,
  animation: Animation,
) {
  item.style.zIndex = "1";
  item.dataset["rising"] = "";
  const lowerIfCurrent = () => {
    if (running.get(item) === animation) {
      lower(item);
    }
  };
  animation.addEventListener("finish", lowerIfCurrent);
  animation.addEventListener("cancel", lowerIfCurrent);
}

function lower(item: HTMLElement) {
  item.style.zIndex = "";
  delete item.dataset["rising"];
}

/** How far down the item's running animation shows it, in px, and how
 *  opaque; nothing and fully opaque without one. */
function currentlyShown(running: WeakMap<Element, Animation>, item: Element) {
  const animation = running.get(item);
  if (!animation || animation.playState !== "running") {
    return { translateY: 0, opacity: 1 };
  }
  const style = getComputedStyle(item);
  return {
    translateY: new DOMMatrix(style.transform).m42,
    opacity: Number(style.opacity),
  };
}

function enterKeyframes(enter: ListEnterAnimation): Keyframe[] {
  if (enter === "slide-in") {
    return [
      { transform: "translateY(-100%)", opacity: 0 },
      { transform: "none", opacity: 1 },
    ];
  }
  return [{ opacity: 0 }, { opacity: 1 }];
}
