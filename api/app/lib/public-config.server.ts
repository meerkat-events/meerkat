import env from "../../env.ts";
import type { Config } from "./config.ts";

/**
 * The settings the browser gets in every page (lib/config.ts). Only these
 * values: everything returned here is sent to every visitor, so it must be
 * public by design.
 */
export function publicConfig(): Config {
  return {
    ...(env.supabaseUrl ? { supabaseUrl: env.supabaseUrl } : {}),
    ...(env.supabaseAnonKey ? { supabaseAnonKey: env.supabaseAnonKey } : {}),
    ...(env.posthogToken ? { posthogToken: env.posthogToken } : {}),
    ...(env.posthogHost ? { posthogHost: env.posthogHost } : {}),
    environment: env.environment,
  };
}
