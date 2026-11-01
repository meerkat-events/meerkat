import posthog from "posthog-js";
import { API_BASE } from "./api-url.ts";
import { getConfig } from "./config.ts";

/** Whether this deployment has PostHog (POSTHOG_PROJECT_TOKEN). */
export function isPostHogEnabled() {
  const config = getConfig();
  return Boolean(config.posthogToken && config.posthogHost);
}

/**
 * Starts PostHog in the browser with the project the server wrote into the
 * page (lib/config.ts). Nothing is sent when the deployment has no
 * POSTHOG_PROJECT_TOKEN.
 *
 * - Exception autocapture reports uncaught errors and unhandled rejections;
 *   the route ErrorBoundaries report what React Router catches.
 * - `tracing_headers` adds the session and distinct id to requests to our
 *   API, which links its traces, logs and exceptions to this session
 *   (api/middlewares/telemetry.ts).
 */
export function initPostHog() {
  const config = getConfig();
  if (!config.posthogToken || !config.posthogHost) {
    return;
  }

  posthog.init(config.posthogToken, {
    api_host: config.posthogHost,
    // Keep this at 2026-06-25 or later: those defaults leave URL fragments
    // out of every event, and the Devcon handover and sign-in links put the
    // Supabase session tokens into the fragment.
    defaults: "2026-08-30",
    capture_exceptions: true,
    tracing_headers: apiHostnames(),
  });
  posthog.register({ environment: config.environment });
}

/** Hostnames the browser sends API requests to (see lib/api-url.ts). */
function apiHostnames() {
  const hostnames = [globalThis.location.hostname];
  if (API_BASE) {
    hostnames.push(new URL(API_BASE).hostname);
  }
  return hostnames;
}

// The "Give feedback" survey in PostHog (an "Open feedback" template survey)
// is shown when this event is captured.
const FEEDBACK_EVENT = "feedback_requested";

/** Opens PostHog's feedback survey. */
export function requestFeedback() {
  posthog.capture(FEEDBACK_EVENT);
}
