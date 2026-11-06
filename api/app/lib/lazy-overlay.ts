import { type ComponentType, lazy } from "react";

function renderNothing() {
  return null;
}

function whenIdle(callback: () => void) {
  if ("requestIdleCallback" in globalThis) {
    requestIdleCallback(callback);
  } else {
    // Safari has no requestIdleCallback.
    setTimeout(callback, 1000);
  }
}

/**
 * A component nobody sees on load (a dialog, a drawer's content, a
 * celebration) in a chunk of its own, so the page loads less up front.
 *
 * In the browser the chunk is fetched once the page is idle, so the component
 * shows at once when it's needed, from the build that served the page. A
 * failed fetch is tried again on first render; if that fails too (a deploy
 * removed the chunk, the network is down), the component renders nothing
 * instead of taking the page down with it.
 */
export function lazyOverlay<Props extends object>(
  load: () => Promise<ComponentType<Props>>,
) {
  let loading: Promise<{ default: ComponentType<Props> }> | undefined;
  const loadOnce = () => {
    loading ??= load().then((component) => ({ default: component }));
    return loading;
  };

  if (typeof document !== "undefined") {
    whenIdle(() => {
      loadOnce().catch(() => {
        loading = undefined;
      });
    });
  }

  const fallback: ComponentType<Props> = renderNothing;
  return lazy(() => loadOnce().catch(() => ({ default: fallback })));
}
