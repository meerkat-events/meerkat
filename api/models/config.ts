import env from "../env.ts";

export const config = {
  base: env.base,
  zupassUrl: env.zupassUrl,
  zappName: env.zappName,
  supabaseUrl: env.supabaseUrl,
  supabaseAnonKey: env.supabaseAnonKey,
  sentryDSN: env.sentryDSN,
  environment: env.environment,
};
