import { useEffect } from "react";
import * as Sentry from "@sentry/react";
import type { Config } from "../lib/config.ts";

export function useTools(config: Config) {
  useEffect(() => {
    if (config.sentryDSN) {
      Sentry.init({
        dsn: config.sentryDSN,
        environment: config.environment,
      });
    }
  }, [config.sentryDSN, config.environment]);
}
