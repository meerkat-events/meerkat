import { apiUrl } from "./api-url.ts";

export type Config = {
  supabaseUrl: string | undefined;
  supabaseAnonKey: string | undefined;
};

export async function getConfig() {
  const response = await fetch(apiUrl("/api/v1/config"));

  const config = await response.json() as Config;

  return config;
}
