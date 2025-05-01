import * as Sentry from "@sentry/deno";
import env from "./env.ts";
import logger from "./logger.ts";

if (env.sentryDSN) {
  Sentry.init({
    dsn: env.sentryDSN,
    environment: env.environment,
  });

  logger.info({ sentryDSN: env.sentryDSN }, "Initialized Sentry");
}
