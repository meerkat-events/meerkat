import { apiUrl } from "./api-url.ts";

export type Config = {
  supabaseUrl: string | undefined;
  supabaseAnonKey: string | undefined;
  posthogToken: string | undefined;
  posthogHost: string | undefined;
  environment: string;
};

// One request per page load: PostHog (entry.client.tsx) and the layouts'
// clientLoader both need the config. A failed request is retried next time.
let configRequest: Promise<Config> | undefined;

export function getConfig() {
  configRequest ??= fetchConfig().catch((error: unknown) => {
    configRequest = undefined;
    throw error;
  });
  return configRequest;
}

async function fetchConfig() {
  const response = await fetch(apiUrl("/api/v1/config"));

  const config = await response.json() as Config;

  return config;
}
