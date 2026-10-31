/** One SSE message: its `event:` name (`message` when unnamed) and data. */
export type EventStreamMessage = { event: string; data: string };

/**
 * Parses SSE text as it arrives, in chunks that may end anywhere. Calls
 * `onMessage` for every complete message. Comment lines and fields other
 * than `event` and `data` are ignored; lines end in "\n" or "\r\n", as our
 * server sends them.
 */
export function createEventStreamParser(
  onMessage: (message: EventStreamMessage) => void,
) {
  let buffer = "";
  let event = "";
  let dataLines: string[] = [];

  function processLine(line: string) {
    if (line === "") {
      if (dataLines.length > 0) {
        onMessage({ event: event || "message", data: dataLines.join("\n") });
      }
      event = "";
      dataLines = [];
      return;
    }
    if (line.startsWith(":")) {
      return;
    }
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) {
      value = value.slice(1);
    }
    if (field === "event") {
      event = value;
    } else if (field === "data") {
      dataLines.push(value);
    }
  }

  return (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      processLine(line.endsWith("\r") ? line.slice(0, -1) : line);
    }
  };
}

export type EventStreamOptions = {
  url: string;
  /** Read before every connection attempt, so a refreshed token is used. */
  getToken: () => string | undefined;
  onMessage: (message: EventStreamMessage) => void;
  /** Called when the stream opens again after it was lost. */
  onReconnect?: () => void;
  /** Aborting it closes the stream for good. */
  signal: AbortSignal;
};

const MIN_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;
// Twice the server's 30-second ping: no data for that long means a dead
// connection that fetch alone would never notice.
const WATCHDOG_MS = 60_000;

type Outcome = "retry" | "unauthorized" | "forbidden";

/**
 * Reads an SSE stream with `fetch`, which, unlike EventSource, can send an
 * Authorization header. Reconnects with backoff until `signal` aborts. A 403
 * stops it, since retrying won't help; a 401 retries at the longest delay,
 * in case the session's token has been refreshed by then.
 */
export async function readEventStream(options: EventStreamOptions) {
  const { signal, onReconnect } = options;
  let delay = MIN_RETRY_MS;
  let hasOpened = false;

  while (!signal.aborted) {
    const outcome = await connectOnce(options, () => {
      if (hasOpened) {
        onReconnect?.();
      }
      hasOpened = true;
      delay = MIN_RETRY_MS;
    });
    if (outcome === "forbidden" || signal.aborted) {
      return;
    }
    if (outcome === "unauthorized") {
      delay = MAX_RETRY_MS;
    }
    await sleep(delay, signal);
    delay = Math.min(delay * 2, MAX_RETRY_MS);
  }
}

async function connectOnce(
  { url, getToken, onMessage, signal }: EventStreamOptions,
  onOpen: () => void,
): Promise<Outcome> {
  const connection = new AbortController();
  const abort = () => connection.abort();
  signal.addEventListener("abort", abort);
  let watchdog = setTimeout(abort, WATCHDOG_MS);

  try {
    const token = getToken();
    const response = await fetch(url, {
      headers: {
        Accept: "text/event-stream",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: connection.signal,
    });
    if (response.status === 401) {
      return "unauthorized";
    }
    if (response.status === 403) {
      return "forbidden";
    }
    if (!response.ok || !response.body) {
      return "retry";
    }

    onOpen();
    const parse = createEventStreamParser(onMessage);
    const reader = response.body.pipeThrough(new TextDecoderStream())
      .getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        return "retry";
      }
      clearTimeout(watchdog);
      watchdog = setTimeout(abort, WATCHDOG_MS);
      parse(value);
    }
  } catch {
    // A network error, or the watchdog or `signal` aborted the request.
    return "retry";
  } finally {
    clearTimeout(watchdog);
    signal.removeEventListener("abort", abort);
  }
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
  });
}
