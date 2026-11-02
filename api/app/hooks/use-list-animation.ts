import { useLayoutEffect, useRef } from "react";

/** How a new item appears: sliding down from where the list starts, or
 *  fading in at its place. */
export type ListEnterAnimation = "slide-from-top" | "fade";

const DURATION_MS = 300;
const EASING = "ease-out";

/**
 * Animates a list's items when a render reorders, adds or removes them, on
 * the Web Animations API (FLIP): every item that moved slides from where it
 * was to where it is now, and a new item slides in or fades in. A removed
 * item just disappears; the ones below it slide up into the gap.
 *
 * Put the returned ref on the list; its direct children are the items. Items
 * are told apart by their DOM node, so they need stable React keys. The
 * items on the list's first render appear without animating, and nothing
 * animates for people who prefer reduced motion.
 */
export function useListAnimation<ListElement extends HTMLElement>(
  enter: ListEnterAnimation,
) {
  const listRef = useRef<ListElement>(null);
  // Where each item was after the previous render, and the list it was in:
  // a list that mounts again (after a loading state) starts over.
  const previousTops = useRef(new WeakMap<Element, number>());
  const previousList = useRef<ListElement | null>(null);
  const runningAnimations = useRef(new WeakMap<Element, Animation>());

  // No dependency list on purpose: compare the layout after every render.
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

    for (const item of list.children) {
      if (!(item instanceof HTMLElement)) {
        continue;
      }
      // offsetTop ignores transforms and scrolling: it's where the item sits
      // in the layout, not where an animation currently shows it.
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
      // Start from where the item shows now: its old place, plus how far a
      // move that's still running has carried it.
      const offset = previousTop + currentTranslateY(running, item) - top;
      if (offset !== 0) {
        startAnimation(running, item, [
          { transform: `translateY(${offset}px)` },
          { transform: "none" },
        ]);
      }
    }
  });

  return listRef;
}

/** Replaces the item's running animation, if any, with a new one. */
function startAnimation(
  running: WeakMap<Element, Animation>,
  item: HTMLElement,
  keyframes: Keyframe[],
) {
  running.get(item)?.cancel();
  const animation = item.animate(keyframes, {
    duration: DURATION_MS,
    easing: EASING,
  });
  running.set(item, animation);
}

/** How far the item's running animation has moved it down, in px. */
function currentTranslateY(
  running: WeakMap<Element, Animation>,
  item: HTMLElement,
) {
  const animation = running.get(item);
  if (!animation || animation.playState !== "running") {
    return 0;
  }
  return new DOMMatrix(getComputedStyle(item).transform).m42;
}

function enterKeyframes(enter: ListEnterAnimation): Keyframe[] {
  if (enter === "slide-from-top") {
    return [
      { transform: "translateY(-100%)", opacity: 0 },
      { transform: "none", opacity: 1 },
    ];
  }
  return [{ opacity: 0 }, { opacity: 1 }];
}
