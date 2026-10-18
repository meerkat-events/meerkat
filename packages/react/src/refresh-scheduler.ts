export interface RefreshScheduler {
  /** Asks for a refresh after a random delay; collapses with pending ones. */
  schedule(): void;
  /** Drops the waiting refresh and any follow-up. */
  cancel(): void;
}

/**
 * Spreads the refetches that one SSE update causes across all viewers, and
 * keeps each viewer to one refetch at a time.
 *
 * `schedule` waits a random 0 to `maxDelayMs` before calling `refresh`.
 * Further calls while it waits are covered by that refresh. Calls while a
 * refresh is in flight collapse into one follow-up, scheduled once it
 * settles, because the running one may have read the list before the change.
 */
export function createRefreshScheduler(
  refresh: () => Promise<unknown>,
  maxDelayMs: number,
): RefreshScheduler {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight = false;
  let followUp = false;

  async function run() {
    timer = undefined;
    inFlight = true;
    try {
      await refresh();
    } catch {
      // The caller's data hook keeps the error; the next update retries.
    } finally {
      inFlight = false;
    }
    if (followUp) {
      followUp = false;
      schedule();
    }
  }

  function schedule() {
    if (inFlight) {
      followUp = true;
      return;
    }
    if (timer !== undefined) return;
    timer = setTimeout(run, Math.random() * maxDelayMs);
  }

  function cancel() {
    clearTimeout(timer);
    timer = undefined;
    followUp = false;
  }

  return { schedule, cancel };
}
