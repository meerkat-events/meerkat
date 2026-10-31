import { useEffect } from "react";
import { isRouteErrorResponse } from "react-router";
import { usePostHog } from "@posthog/react";
import { HTTPError } from "./http-error.ts";

/**
 * Reports an error that a route's ErrorBoundary caught to PostHog error
 * tracking. A 4xx answer (an unknown URL or event) is not a bug and is left
 * out.
 */
export function useReportRouteError(error: unknown) {
  const posthog = usePostHog();
  useEffect(() => {
    if (!isClientError(error)) {
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
