import { useCallback, useEffect, useRef, useState } from "react";

export interface UseEventSourceOptions {
  url: string | undefined;
  onMessage: () => void;
}

interface UseEventSourceReturn {
  isConnected: boolean;
}

const WATCHDOG_TIMEOUT = 60_000; // 2× the 30s server heartbeat

export function useEventSource({
  url,
  onMessage,
}: UseEventSourceOptions): UseEventSourceReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);
  const esRef = useRef<EventSource | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stableOnMessage = useCallback(() => {
    onMessage();
  }, [onMessage]);

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
    };
    es.onmessage = (e) => {
      resetWatchdog();
      if (e.data !== "ping") stableOnMessage();
    };
    es.onerror = () => {
      setIsConnected(es.readyState === EventSource.OPEN);
    };

    return () => {
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
      es.close();
      esRef.current = null;
      setIsConnected(false);
    };
  }, [url, stableOnMessage, resetWatchdog, reconnectCount]);

  return { isConnected };
}
