import { useEffect, useRef, useState } from "react";
import { reconnectDelayMs } from "./reconnect-delay.ts";

export interface UseEventSourceOptions {
  url: string | undefined;
  /**
   * Called for every unnamed message except `ping`, and every time the
   * connection opens: messages sent before it was open (or while it was
   * down) are lost, so the caller refetches.
   */
  onMessage: () => void;
  /**
   * Handlers for named events (`event: <name>` on the server), called with
   * the message's data, e.g. `{ reaction: (data) => … }`.
   */
  events?: Record<string, (data: string) => void>;
}

interface UseEventSourceReturn {
  isConnected: boolean;
}

// About 2.5× the server's 15 s ping: a connection silent for this long is
// dead (a network that dropped it without telling us).
const WATCHDOG_TIMEOUT = 40_000;

/**
 * Keeps an EventSource open on `url` for as long as the page is visible.
 *
 * The browser reconnects by itself after a dropped connection, but gives up
 * for good when a reconnect gets an error response (a 502 while the server
 * restarts, say); then, and when the watchdog finds the stream silent, this
 * hook reconnects with backoff. A hidden page closes the stream, and it
 * reopens when the page is visible again or the device is back online.
 */
export function useEventSource({
  url,
  onMessage,
  events,
}: UseEventSourceOptions): UseEventSourceReturn {
  const [isConnected, setIsConnected] = useState(false);

  // Callbacks live in refs, so a caller passing new functions on every
  // render doesn't reconnect.
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const eventNames = Object.keys(events ?? {}).sort().join(",");

  useEffect(() => {
    if (!url) {
      setIsConnected(false);
      return;
    }
    const streamUrl = url;

    let es: EventSource | undefined;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    // Failed connects in a row, for the backoff; reset once one opens.
    let failedAttempts = 0;

    function resetWatchdog() {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        disconnect();
        scheduleReconnect();
      }, WATCHDOG_TIMEOUT);
    }

    function connect() {
      disconnect();
      const source = new EventSource(streamUrl);
      es = source;

      source.onopen = () => {
        failedAttempts = 0;
        setIsConnected(true);
        resetWatchdog();
        onMessageRef.current();
      };
      source.onmessage = (e) => {
        resetWatchdog();
        if (e.data !== "ping") onMessageRef.current();
      };
      source.onerror = () => {
        setIsConnected(false);
        // CONNECTING: the browser retries by itself. CLOSED: it gave up.
        if (source.readyState === EventSource.CLOSED) {
          disconnect();
          scheduleReconnect();
        }
      };

      for (const name of eventNames ? eventNames.split(",") : []) {
        source.addEventListener(name, (e) => {
          resetWatchdog();
          eventsRef.current?.[name]?.((e as MessageEvent<string>).data);
        });
      }
    }

    function disconnect() {
      clearTimeout(watchdog);
      clearTimeout(reconnectTimer);
      es?.close();
      es = undefined;
      setIsConnected(false);
    }

    function scheduleReconnect() {
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, reconnectDelayMs(failedAttempts));
      failedAttempts += 1;
    }

    function isHidden() {
      return globalThis.document.visibilityState === "hidden";
    }

    function onVisibilityChange() {
      if (isHidden()) {
        disconnect();
      } else if (!es) {
        connect();
      }
    }

    // A connection the browser is still retrying may wait seconds more;
    // being back online is the moment to try.
    function onOnline() {
      if (!isHidden() && es?.readyState !== EventSource.OPEN) {
        failedAttempts = 0;
        connect();
      }
    }

    if (!isHidden()) connect();
    globalThis.document.addEventListener("visibilitychange", onVisibilityChange);
    globalThis.addEventListener("online", onOnline);

    return () => {
      globalThis.document.removeEventListener(
        "visibilitychange",
        onVisibilityChange,
      );
      globalThis.removeEventListener("online", onOnline);
      disconnect();
    };
  }, [url, eventNames]);

  return { isConnected };
}
