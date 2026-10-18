import { createMiddleware } from "hono/factory";
import logger from "../logger.ts";

/**
 * One log line per request: method, path, status and duration. The path is
 * `c.req.path`, which has no query string, so a Devcon handover token
 * (`/e/:uid/qa?token=<jwt>`) or any other query parameter never reaches the
 * logs.
 */
export const requestLogger = () =>
  createMiddleware(async (c, next) => {
    const started = performance.now();
    await next();
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
