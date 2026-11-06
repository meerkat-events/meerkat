import { createMiddleware } from "hono/factory";
import logger from "../logger.ts";

/**
 * One log line per request: method, path, status and duration. The path is
 * `c.req.path`, which has no query string, so a Devcon handover token
 * (`/e/:uid/qa?token=<jwt>`) or any other query parameter never reaches the
 * logs. Build assets served fine are left out: a page load fetches dozens.
 * A missing one is still logged (a browser holding an older build's HTML).
 */
export const requestLogger = () =>
  createMiddleware(async (c, next) => {
    const started = performance.now();
    await next();
    if (c.req.path.startsWith("/assets/") && c.res.status < 400) {
      return;
    }
    logger.info(
      {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs: Math.round(performance.now() - started),
      },
      "Request",
    );
  });
