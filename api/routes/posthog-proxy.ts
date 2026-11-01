import { Hono } from "hono";
import { cors } from "hono/cors";
import env from "../env.ts";
import logger from "../logger.ts";
import { POSTHOG_PROXY_PATH, posthogAssetsHost } from "../posthog-hosts.ts";

/**
 * A reverse proxy for posthog-js (app/lib/posthog.ts): the browser sends its
 * events, exceptions and survey requests to our own origin, which blockers
 * leave alone, and this forwards them to PostHog. After PostHog's Node proxy
 * (https://posthog.com/docs/advanced/proxy/node).
 *
 * Mounted ahead of the request log and telemetry middlewares (app.ts):
 * every page sends a steady stream of these requests, which our own logs and
 * traces don't need.
 */
const posthogProxy = new Hono();

// Hop-by-hop headers, which belong to one connection, and the ones fetch
// sets itself (host, content-length, accept-encoding: it decompresses the
// response, see below).
const NOT_FORWARDED_REQUEST_HEADERS = [
  "connection",
  "keep-alive",
  "transfer-encoding",
  "te",
  "upgrade",
  "proxy-authorization",
  "host",
  "content-length",
  "accept-encoding",
  // Our session cookies and Fly's and other proxies' headers are none of
  // PostHog's business; the attendee's IP is set below.
  "cookie",
  "forwarded",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
  "x-forwarded-ssl",
  "x-real-ip",
  "via",
];

const NOT_FORWARDED_RESPONSE_HEADERS = [
  "connection",
  "keep-alive",
  "transfer-encoding",
  // fetch has decompressed the body, so it no longer matches these.
  "content-encoding",
  "content-length",
  "set-cookie",
];

// PostHog answers in well under a second; a hung upstream must not hold the
// attendee's request (and a Fly concurrency slot) open.
const UPSTREAM_TIMEOUT_MS = 10_000;

/** The headers to send to PostHog for the browser's request. */
export function upstreamRequestHeaders(request: Request) {
  const headers = new Headers(request.headers);
  for (const name of NOT_FORWARDED_REQUEST_HEADERS) {
    headers.delete(name);
  }
  // posthog-js sends its project token (`Bearer phc_…`) to some endpoints.
  // Any other credentials stay here.
  if (!headers.get("authorization")?.startsWith("Bearer phc_")) {
    headers.delete("authorization");
  }
  // PostHog geolocates events by the client's IP. Fly's proxy puts the
  // attendee's in Fly-Client-IP; without it (local development) PostHog sees
  // this server's.
  const clientIp = request.headers.get("fly-client-ip");
  if (clientIp) {
    headers.set("x-forwarded-for", clientIp);
    headers.set("x-real-ip", clientIp);
  }
  return headers;
}

/**
 * The PostHog URL for a proxied path and query string: scripts from the
 * assets host, everything else from the ingestion host. The path is set on
 * a fixed origin rather than resolved against it, so a path like
 * `//elsewhere.example` can't send the request to another host.
 */
export function upstreamUrl(posthogHost: string, path: string, search: string) {
  const isAsset = path.startsWith("/static/") || path.startsWith("/array/");
  const url = new URL(isAsset ? posthogAssetsHost(posthogHost) : posthogHost);
  url.pathname = path;
  url.search = search;
  return url;
}

posthogProxy.use(
  `${POSTHOG_PROXY_PATH}/*`,
  // Only matters when the frontend is on another origin (VITE_API_URL).
  cors({ origin: env.corsOrigins, maxAge: 86400 }),
);

posthogProxy.on(["GET", "POST"], `${POSTHOG_PROXY_PATH}/*`, async (c) => {
  if (!env.posthogHost) {
    return c.notFound();
  }

  const request = c.req.raw;
  const path = c.req.path.slice(POSTHOG_PROXY_PATH.length);
  const target = upstreamUrl(env.posthogHost, path, new URL(request.url).search);
  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  // `duplex` is Node's fetch option for a stream body, which the DOM's
  // RequestInit type doesn't know: the body is streamed, not buffered.
  const init: RequestInit & { duplex: "half" } = {
    method: request.method,
    headers: upstreamRequestHeaders(request),
    body: hasBody ? request.body : null,
    duplex: "half",
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  };

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (err) {
    logger.warn({ err, path }, "PostHog proxy request failed");
    return c.json({ error: "Bad gateway" }, 502);
  }

  const headers = new Headers(upstream.headers);
  for (const name of NOT_FORWARDED_RESPONSE_HEADERS) {
    headers.delete(name);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
});

export default posthogProxy;
