// OpenTelemetry for the server: traces of every request (and of the fetches
// it makes) and every pino log line go to PostHog over OTLP. Loaded before
// main.ts with `node --import ./instrumentation.ts ./main.ts`: instrumenting
// ES modules (node:http, pino, undici) needs the loader hook registered below
// before they are imported.
import { register } from "node:module";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";
import { PostHogContextSpanProcessor } from "posthog-node/otel";
import env from "./env.ts";
import { posthog } from "./posthog.ts";
import { POSTHOG_PROXY_PATH, posthogAssetsHost } from "./posthog-hosts.ts";

// Requests that would only add noise: Fly's health check every 30 s per
// machine, static files, and the browser's PostHog requests through our
// proxy (routes/posthog-proxy.ts).
function isIgnoredPath(path: string) {
  return path === "/api/v1/health" ||
    path.startsWith("/assets/") ||
    path.startsWith(`${POSTHOG_PROXY_PATH}/`);
}

// Spans record the query string (`url.query`). These parameters carry
// credentials: the Devcon handover token (`/e/:uid/qa?token=<jwt>`), Supabase
// Auth's sign-in links, and the instrumentation's own defaults (signed cloud
// storage URLs), and `search`, which can hold part of an email (the
// permissions page's attendee search). The list replaces the defaults, so it
// repeats them.
const REDACTED_QUERY_PARAMS = [
  "search",
  "token",
  "token_hash",
  "code",
  "access_token",
  "refresh_token",
  "sig",
  "Signature",
  "AWSAccessKeyId",
  "X-Goog-Signature",
  "X-Amz-Signature",
  "X-Amz-Credential",
  "X-Amz-Security-Token",
];

/**
 * Span attributes for an outgoing fetch that leave out its query string.
 * The undici instrumentation records `url.full` and `url.query` as they are
 * and has no list of parameters to redact.
 */
function withoutQuery(request: { origin: string; path: string }) {
  const url = new URL(request.path, request.origin);
  if (!url.search) {
    return {};
  }
  return { "url.full": `${url.origin}${url.pathname}`, "url.query": "REDACTED" };
}

function startTelemetry(token: string, host: string) {
  register("@opentelemetry/instrumentation/hook.mjs", import.meta.url);

  const headers = { Authorization: `Bearer ${token}` };
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      "service.name": "meerkat",
      "deployment.environment.name": env.environment,
    }),
    spanProcessors: [
      // Adds the request's PostHog distinct and session id to its spans, so
      // a trace links to the browser session that caused it.
      ...(posthog ? [new PostHogContextSpanProcessor(posthog)] : []),
      new BatchSpanProcessor({
        exporter: new OTLPTraceExporter({
          url: `${host}/i/v1/traces`,
          headers,
        }),
      }),
    ],
    logRecordProcessors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({ url: `${host}/i/v1/logs`, headers }),
      }),
    ],
    instrumentations: [
      new HttpInstrumentation({
        redactedQueryParamsServer: REDACTED_QUERY_PARAMS,
        redactedQueryParams: REDACTED_QUERY_PARAMS,
        ignoreIncomingRequestHook: (request) =>
          isIgnoredPath(new URL(request.url ?? "/", "http://localhost").pathname),
      }),
      new UndiciInstrumentation({
        // posthog-node's own requests to PostHog, and the proxy's.
        ignoreRequestHook: (request) =>
          request.origin === host || request.origin === posthogAssetsHost(host),
        startSpanHook: withoutQuery,
      }),
      new PinoInstrumentation({
        // Log lines written during a request carry the browser's PostHog ids
        // (middlewares/telemetry.ts), which link them to its session.
        logHook: (_span, record) => {
          const context = posthog?.getContext();
          if (context?.distinctId) {
            record["posthogDistinctId"] = context.distinctId;
          }
          if (context?.sessionId) {
            record["sessionId"] = context.sessionId;
          }
        },
      }),
    ],
  });
  sdk.start();
  return sdk;
}

const sdk = env.posthogToken && env.posthogHost
  ? startTelemetry(env.posthogToken, env.posthogHost)
  : undefined;

// Fly kills a machine 5 s after asking it to stop.
const SHUTDOWN_TIMEOUT_MS = 3000;

/**
 * Sends the buffered spans, log lines and exceptions, for shutting down.
 * Gives up after SHUTDOWN_TIMEOUT_MS, so an unreachable PostHog doesn't hold
 * up a restart.
 */
export async function shutdownTelemetry() {
  const flushed = Promise.allSettled([
    sdk?.shutdown(),
    posthog?.shutdown(SHUTDOWN_TIMEOUT_MS),
  ]);
  const timeout = new Promise((resolve) => {
    setTimeout(resolve, SHUTDOWN_TIMEOUT_MS).unref();
  });
  await Promise.race([flushed, timeout]);
}
