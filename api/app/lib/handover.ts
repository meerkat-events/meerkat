/**
 * Client-safe pieces of the Devcon handover (see `handover.server.ts` for the
 * server side). Spec:
 * https://github.com/efdevcon/monorepo/blob/main/event-app/src/app/api/meerkat/README.md
 */

/** Query parameter the Devcon event app appends when redirecting to Meerkat. */
export const HANDOVER_TOKEN_PARAM = "token";

/** Query parameter the server redirects back with when a handover fails. */
export const HANDOVER_ERROR_PARAM = "handover";

export type HandoverError = "expired" | "invalid" | "failed";

export const HANDOVER_ERROR_MESSAGES: Record<HandoverError, string> = {
  expired:
    "Your Devcon sign-in link has expired. Go back to the Devcon app and try again.",
  invalid:
    "This Devcon sign-in link is not valid. Go back to the Devcon app and try again.",
  failed:
    "Signing you in from the Devcon app did not work. Please go back and try again.",
};

export const parseHandoverError = (
  value: string | null,
): HandoverError | undefined =>
  value !== null && value in HANDOVER_ERROR_MESSAGES
    ? value as HandoverError
    : undefined;
