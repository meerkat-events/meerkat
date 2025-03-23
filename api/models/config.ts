import env from "../env.ts";

export const config = {
  base: env.base,
  zupassUrl: env.zupassUrl,
  zappName: env.zappName,
  posthogToken: env.posthogToken,
  supabaseUrl: env.supabaseUrl,
  supabaseAnonKey: env.supabaseAnonKey,
  sentryDSN: env.sentryDSN,
  environment: env.environment,
  grafanaUrl: env.grafanaUrl,
};
