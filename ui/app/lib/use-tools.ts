import { useEffect } from "react";
import { posthog } from "posthog-js";
import * as Sentry from "@sentry/react";
import { initializeFaro } from "@grafana/faro-react";
import type { Config } from "./config";

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

  useEffect(() => {
    if (config.grafanaUrl) {
      initializeFaro({
        url: config.grafanaUrl,
        app: {
          name: "ui",
          environment: config.environment,
        },
      });
    }
  }, [config.grafanaUrl]);
}
