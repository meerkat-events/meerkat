export interface Coalescer {
  /** Asks for a run: right away if no window is open, otherwise once it ends. */
  trigger(): void;
  /** Drops a pending run and closes the window. */
  cancel(): void;
}

/**
 * Runs `run` at most once per `windowMs`, however often `trigger` is called.
 *
 * The first trigger runs immediately and opens a window (leading edge).
 * Triggers during the window are collapsed into one run when it ends
 * (trailing edge), which opens the next window, so the last trigger is never
 * lost. A window that ends without triggers calls `onIdle`, where a caller
 * that keeps one coalescer per key can forget it.
 *
 * `run` must not throw: it runs from a timer, where nothing could catch it.
 */
export function coalesce(
  run: () => void,
  windowMs: number,
  onIdle?: () => void,
): Coalescer {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending = false;

  function openWindow() {
    timer = setTimeout(endWindow, windowMs);
  }

  function endWindow() {
    if (pending) {
      pending = false;
      run();
      openWindow();
      return;
    }
    timer = undefined;
    onIdle?.();
  }

  function trigger() {
    if (timer !== undefined) {
      pending = true;
      return;
    }
    run();
    openWindow();
  }

  function cancel() {
    clearTimeout(timer);
    timer = undefined;
    pending = false;
  }

  return { trigger, cancel };
}
