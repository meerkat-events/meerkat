export type Config = {
  zupassUrl: string;
  zappName: string;
  environment: string;
  posthogToken: string | undefined;
  supabaseUrl: string | undefined;
  supabaseAnonKey: string | undefined;
  sentryDSN: string | undefined;
};

export async function getConfig() {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/v1/config`,
  );

  const config = await response.json() as Config;

  return config;
}
