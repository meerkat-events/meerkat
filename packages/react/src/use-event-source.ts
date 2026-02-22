import { useCallback, useEffect, useRef, useState } from "react";

interface UseEventSourceOptions {
  url: string | undefined;
  onMessage: () => void;
}

interface UseEventSourceReturn {
  isConnected: boolean;
}

export function useEventSource({
  url,
  onMessage,
}: UseEventSourceOptions): UseEventSourceReturn {
  const [isConnected, setIsConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const stableOnMessage = useCallback(() => {
    onMessage();
  }, [onMessage]);

  useEffect(() => {
    if (!url) {
      setIsConnected(false);
      return;
    }

    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setIsConnected(true);
    es.onmessage = () => stableOnMessage();
    es.onerror = () => {
      setIsConnected(es.readyState === EventSource.OPEN);
    };

    return () => {
      es.close();
      esRef.current = null;
      setIsConnected(false);
    };
  }, [url, stableOnMessage]);

  return { isConnected };
}
