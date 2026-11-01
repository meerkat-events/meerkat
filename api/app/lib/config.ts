/**
 * The browser's settings. The server writes them into every page it renders
 * (the root route's loader, `public-config.server.ts`), so they come from its
 * environment at runtime and the browser needs no request for them.
 */
export type Config = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  posthogToken?: string;
  posthogHost?: string;
  environment: string;
};

/** Id of the `<script type="application/json">` the root layout renders. */
export const CONFIG_ELEMENT_ID = "meerkat-config";

/**
 * The config from the page. Browser only; a page rendered without it (the
 * root ErrorBoundary) gets no Supabase or PostHog.
 */
export function getConfig(): Config {
  const element = globalThis.document?.getElementById(CONFIG_ELEMENT_ID);
  if (!element?.textContent) {
    return { environment: "development" };
  }
  return JSON.parse(element.textContent) as Config;
}

/**
 * The config as the content of the inline script: JSON with `<` escaped, so
 * no value can close the script tag.
 */
export function serializeConfig(config: Config) {
  return JSON.stringify(config).replaceAll("<", "\\u003c");
}
