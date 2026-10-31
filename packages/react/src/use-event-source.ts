import { useCallback, useEffect, useRef, useState } from "react";

export interface UseEventSourceOptions {
  url: string | undefined;
  /**
   * Called for every unnamed message except `ping`, and once after the
   * connection re-opens, since messages sent while it was down are lost.
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

const WATCHDOG_TIMEOUT = 60_000; // 2× the 30s server heartbeat

export function useEventSource({
  url,
  onMessage,
  events,
}: UseEventSourceOptions): UseEventSourceReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);
  const esRef = useRef<EventSource | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The URL the current connection has opened before, so a re-open (the
  // browser's own reconnect, or the watchdog's) can tell itself apart from
  // the first open.
  const openedUrlRef = useRef<string | undefined>(undefined);

  // Callbacks live in refs, so a caller passing new functions on every
  // render doesn't reconnect.
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const eventNames = Object.keys(events ?? {}).sort().join(",");

  const resetWatchdog = useCallback(() => {
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    watchdogRef.current = setTimeout(() => {
      esRef.current?.close();
      setIsConnected(false);
      setReconnectCount((n) => n + 1);
    }, WATCHDOG_TIMEOUT);
  }, []);

  useEffect(() => {
    if (!url) {
      setIsConnected(false);
      return;
    }

    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      resetWatchdog();
      if (openedUrlRef.current === url) {
        onMessageRef.current();
      }
      openedUrlRef.current = url;
    };
    es.onmessage = (e) => {
      resetWatchdog();
      if (e.data !== "ping") onMessageRef.current();
    };
    es.onerror = () => {
      setIsConnected(es.readyState === EventSource.OPEN);
    };

    for (const name of eventNames ? eventNames.split(",") : []) {
      es.addEventListener(name, (e) => {
        resetWatchdog();
        eventsRef.current?.[name]?.((e as MessageEvent<string>).data);
      });
    }

    return () => {
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
      es.close();
      esRef.current = null;
      setIsConnected(false);
    };
  }, [url, eventNames, resetWatchdog, reconnectCount]);

  return { isConnected };
}
