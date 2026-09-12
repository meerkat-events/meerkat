import { apiUrl } from "./api-url.ts";

export type Config = {
  zupassUrl: string;
  zappName: string;
  environment: string;
  supabaseUrl: string | undefined;
  supabaseAnonKey: string | undefined;
  sentryDSN: string | undefined;
};

export async function getConfig() {
  const response = await fetch(apiUrl("/api/v1/config"));

  const config = await response.json() as Config;

  return config;
}
