import env from "../env.ts";

export const config = {
  base: env.base,
  supabaseUrl: env.supabaseUrl,
  supabaseAnonKey: env.supabaseAnonKey,
  // For the browser's PostHog client (app/lib/posthog.ts); the token is
  // public by design.
  posthogToken: env.posthogToken,
  posthogHost: env.posthogHost,
  environment: env.environment,
};
