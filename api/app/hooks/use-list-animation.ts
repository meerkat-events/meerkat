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
 * the list must be their offsetParent (position: relative in its CSS). An
 * item moving up is marked `data-rising` while it moves, for the list's CSS
 * to paint it above the others.
 * `itemKeys` identifies the items in order (their uids joined), so the list
 * is measured only when they change. Items are told apart by their DOM node,
 * so their React keys must be stable. The items on the list's first render
 * appear without animating, and nothing animates for people who prefer
 * reduced motion.
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
    const reduceMotion = globalThis.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const running = runningAnimations.current;
    // A list that scrolls on its own: the browser's scroll anchoring may just
    // have scrolled it to keep the visible items in place, before its scroll
    // event. The items didn't move on screen by that much.
    const anchoringShift = isFirstRender
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
      const moved = previousTop - top + anchoringShift;
      // Under a pixel is no move: offsetTop is rounded, while scroll
      // anchoring scrolls by fractions on high-density screens. Let an
      // animation that's still running finish.
      if (Math.abs(moved) < 1) {
        continue;
      }
      // Start from where the item shows now, which includes how far a
      // running animation has carried it and how faded in it is.
      const shown = currentlyShown(running, item);
      const animation = startAnimation(running, item, [
        {
          transform: `translateY(${moved + shown.translateY}px)`,
          opacity: shown.opacity,
        },
        { transform: "none", opacity: 1 },
      ]);
      // An item moving up passes the ones moving down to make room, which
      // would otherwise paint over it (they come later in the list).
      if (moved > 0) {
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
  delete item.dataset["rising"];
  const animation = item.animate(keyframes, {
    duration: DURATION_MS,
    easing: EASING,
  });
  running.set(item, animation);
  return animation;
}

/**
 * Marks the item `data-rising` until its animation ends, so the list's CSS
 * can paint it above its siblings. A newer animation that replaced this one
 * decides for itself, so its mark isn't removed here.
 */
function raiseWhileRunning(
  running: WeakMap<Element, Animation>,
  item: HTMLElement,
  animation: Animation,
) {
  item.dataset["rising"] = "";
  const lower = () => {
    if (running.get(item) === animation) {
      delete item.dataset["rising"];
    }
  };
  animation.addEventListener("finish", lower);
  animation.addEventListener("cancel", lower);
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
