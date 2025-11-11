import { useEffect } from "react";
import { posthog } from "posthog-js";
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

  useEffect(() => {
    if (config.posthogToken) {
      posthog.init(config.posthogToken, {
        api_host: "https://eu.i.posthog.com",
        person_profiles: "identified_only",
      });
    }
  }, [config.posthogToken]);
}
