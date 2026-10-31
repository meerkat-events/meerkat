import { PostHog } from "posthog-node";
import env from "./env.ts";
import { withoutQueryDetails } from "./logger.ts";

/**
 * The server's PostHog client, for exception tracking and the request context
 * (distinct and session id of the browser that sent the request) that
 * exceptions, spans and log lines are linked to. Undefined when
 * POSTHOG_PROJECT_TOKEN is not set.
 *
 * Exception autocapture stays off: main.ts owns the process error handlers
 * and reports from there, so an uncaught exception is sent before the process
 * exits.
 */
export const posthog = env.posthogToken && env.posthogHost
  ? new PostHog(env.posthogToken, {
    host: env.posthogHost,
    enableExceptionAutocapture: false,
  })
  : undefined;

/**
 * Queues an exception for PostHog error tracking. Inside a request it is
 * linked to the browser's session and person through the request context
 * (middlewares/telemetry.ts).
 */
export function reportException(error: unknown) {
  posthog?.captureException(withoutQueryDetails(error), undefined, {
    environment: env.environment,
  });
}
