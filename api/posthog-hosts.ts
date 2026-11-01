// PostHog's hosts and the path our own reverse proxy for it answers on
// (routes/posthog-proxy.ts). No dependencies: the browser (app/lib/posthog.ts)
// and instrumentation.ts import it too.

/**
 * Where the browser sends its PostHog requests, on our own origin. Ad and
 * tracking blockers drop requests to *.posthog.com and to obvious paths like
 * /posthog or /analytics, so the name says nothing about PostHog.
 */
export const POSTHOG_PROXY_PATH = "/relay";

// PostHog Cloud's ingestion hosts, one per region: https://eu.i.posthog.com
// and https://us.i.posthog.com.
const CLOUD_HOST = /^(?<region>[a-z]+)\.i\.posthog\.com$/;

/**
 * The host serving PostHog's scripts (/static/*, /array/*): for a Cloud
 * ingestion host its region's assets host (https://eu-assets.i.posthog.com),
 * otherwise (a self-hosted PostHog) the host itself.
 */
export function posthogAssetsHost(host: string) {
  const url = new URL(host);
  const region = CLOUD_HOST.exec(url.hostname)?.groups?.["region"];
  if (!region) {
    return url.origin;
  }
  return `https://${region}-assets.i.posthog.com`;
}

/**
 * The PostHog app for a Cloud ingestion host (https://eu.posthog.com), which
 * posthog-js links to (toolbar, surveys) and can't derive once its requests
 * go through our proxy. Undefined for a self-hosted PostHog, whose app is on
 * its ingestion host.
 */
export function posthogUiHost(host: string) {
  const region = CLOUD_HOST.exec(new URL(host).hostname)?.groups?.["region"];
  if (!region) {
    return undefined;
  }
  return `https://${region}.posthog.com`;
}
