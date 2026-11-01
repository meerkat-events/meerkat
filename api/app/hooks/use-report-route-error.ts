import { useEffect } from "react";
import { isRouteErrorResponse } from "react-router";
import { usePostHog } from "@posthog/react";
import { HTTPError } from "./http-error.ts";

// What a server loader or render error becomes in the browser: React Router
// hides the original, which the server already reported (entry.server.tsx).
const SANITIZED_SERVER_ERROR = "Unexpected Server Error";

/**
 * Reports an error that a route's ErrorBoundary caught to PostHog error
 * tracking. A 4xx answer (an unknown URL or event) is not a bug, and a server
 * error was reported by the server, so both are left out.
 */
export function useReportRouteError(error: unknown) {
  const posthog = usePostHog();
  useEffect(() => {
    if (!isClientError(error) && !isServerError(error)) {
      posthog?.captureException(error);
    }
  }, [posthog, error]);
}

function isClientError(error: unknown) {
  const status = isRouteErrorResponse(error) || error instanceof HTTPError
    ? error.status
    : undefined;
  return status !== undefined && status >= 400 && status < 500;
}

function isServerError(error: unknown) {
  return error instanceof Error && error.message === SANITIZED_SERVER_ERROR;
}
