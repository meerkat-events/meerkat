import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createRequestHandler, type ServerBuild } from "react-router";
import app from "./app.ts";
import env, { redactedEnv } from "./env.ts";
import logger from "./logger.ts";
import { hub } from "./realtime/index.ts";
import { shutdownTelemetry } from "./instrumentation.ts";
import { reportException } from "./posthog.ts";

// A stray rejection from background work (Realtime cleanup, an SSE write to a
// closed connection) is logged and the server keeps running, rather than
// dropping every request and stream on the instance. An uncaught exception
// leaves the process in an unknown state, so it is logged and the server
// exits; Fly restarts it.
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection");
  reportException(reason);
});
process.on("uncaughtException", async (error) => {
  logger.fatal({ err: error }, "Uncaught exception, exiting");
  reportException(error);
  // Sends the exception, giving up after a few seconds.
  await shutdownTelemetry();
  process.exit(1);
});

// Fly stops a machine with SIGINT (SIGTERM elsewhere, and from `node
// --watch`). Send the buffered log lines, spans and exceptions first.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    logger.info({ signal }, "Shutting down");
    await shutdownTelemetry();
    process.exit(0);
  });
}

logger.info({ env: redactedEnv }, "Parsed environment variables");
if (!env.openRouterApiKey) {
  logger.info("OPENROUTER_API_KEY not set, moderation disabled");
}

// LISTEN right away rather than on the first stream, so the realtime
// self-check in the logs tells after a deploy whether instances hear each
// other.
hub.start();

// How many SSE streams this instance holds, once a minute: during an event
// the logs show whether clients are connected and how they spread across
// machines (Fly queues requests at hard_limit, and every stream counts).
const STREAM_COUNT_INTERVAL_MS = 60_000;
setInterval(() => {
  logger.info({ openStreams: hub.listenerCount() }, "Open SSE streams");
}, STREAM_COUNT_INTERVAL_MS).unref();

// @ts-expect-error - generated React Router build output has no TypeScript declarations
const build = (await import("./build/server/index.js")) as unknown as ServerBuild;
const handler = createRequestHandler(build, "production");

app.get(
  "*",
  serveStatic({
    root: "./build/client",
    onFound(path, c) {
      if (path.startsWith("/assets/")) {
        c.header("Cache-Control", "public, max-age=31536000, immutable");
      } else {
        c.header("Cache-Control", "public, max-age=600");
      }
    },
  }),
);

// A missing build asset is a plain 404, not a page: during a rolling deploy a
// browser with the other build's HTML asks for chunks this build doesn't
// have, and React Router would report each one as a route error.
app.get("/assets/*", (c) => c.notFound());

app.get("*", (c) => handler(c.req.raw));

serve({ fetch: app.fetch, hostname: "0.0.0.0", port: env.port }, (info) => {
  logger.info({ address: info.address, port: info.port }, "Server running");
});
