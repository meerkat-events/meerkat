import type { HTTPError } from "./http-error.ts";

/**
 * `useSWRMutation` options for a mutation the server rate limits: a 429 goes
 * to `onRateLimited` (the cooldown modal), any other error to `onError`.
 *
 * The handlers are the only error path: `trigger` resolves to undefined
 * instead of rejecting. Callers fire it without awaiting, so a rejection
 * would be unhandled and land in error tracking.
 */
export function rateLimitedMutationOptions({ onRateLimited, onError }: {
  onRateLimited: (error: HTTPError) => void;
  onError: ((error: HTTPError) => void) | undefined;
}): { throwOnError: false; onError: (error: HTTPError) => void } {
  return {
    throwOnError: false,
    onError: (error) => {
      if (error.status === 429) {
        onRateLimited(error);
      } else {
        onError?.(error);
      }
    },
  };
}
