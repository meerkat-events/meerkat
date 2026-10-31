import { trace } from "@opentelemetry/api";
import { createMiddleware } from "hono/factory";
import { posthog } from "../posthog.ts";

/**
 * Links each request to the browser session that sent it, and names its
 * trace span after the route.
 *
 * posthog-js adds `X-POSTHOG-DISTINCT-ID` and `X-POSTHOG-SESSION-ID` to the
 * browser's requests to this origin (`tracing_headers` in
 * app/lib/posthog.ts). Running the request inside a PostHog context with
 * them links everything the request causes to that session: its spans
 * (instrumentation.ts), its log lines and its exceptions.
 */
export const telemetry = () =>
  createMiddleware(async (c, next) => {
    if (posthog) {
      const distinctId = headerValue(c.req.header("x-posthog-distinct-id"));
      const sessionId = headerValue(c.req.header("x-posthog-session-id"));
      await posthog.withContext(
        {
          ...(distinctId ? { distinctId } : {}),
          ...(sessionId ? { sessionId } : {}),
        },
        () => next(),
        { fresh: true },
      );
    } else {
      await next();
    }

    // "GET /api/v1/events/:uid" rather than the HTTP instrumentation's bare
    // "GET". Pages (the "*" catch-all) keep it: their paths are unbounded.
    const route = c.req.routePath;
    if (route !== "*" && route !== "/*") {
      const span = trace.getActiveSpan();
      span?.updateName(`${c.req.method} ${route}`);
      span?.setAttribute("http.route", route);
    }
  });

/** A header value without control characters, at most 200 characters long. */
function headerValue(value: string | undefined) {
  const cleaned = value?.replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim();
  return cleaned ? cleaned.slice(0, 200) : undefined;
}
