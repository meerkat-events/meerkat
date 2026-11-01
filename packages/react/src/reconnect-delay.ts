const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

/**
 * How long to wait before reconnecting after `failedAttempts` failures in a
 * row: exponential backoff (1 s, 2 s, 4 s, … up to 30 s) with full jitter, a
 * random wait between 0 and that ceiling, so clients that lost their stream
 * together (a deploy, a restart) come back spread out.
 */
export function reconnectDelayMs(failedAttempts: number): number {
  const ceiling = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** failedAttempts);
  return Math.random() * ceiling;
}
