import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createRequestHandler, type ServerBuild } from "react-router";
import app from "./app.ts";
import env, { redactedEnv } from "./env.ts";
import logger from "./logger.ts";
import { hub } from "./realtime/index.ts";

// A stray rejection from background work (Realtime cleanup, an SSE write to a
// closed connection) is logged and the server keeps running, rather than
// dropping every request and stream on the instance. An uncaught exception
// leaves the process in an unknown state, so it is logged and the server
// exits; Fly restarts it.
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection");
});
process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Uncaught exception, exiting");
  process.exit(1);
});

logger.info({ env: redactedEnv }, "Parsed environment variables");
if (!env.openRouterApiKey) {
  logger.info("OPENROUTER_API_KEY not set, moderation disabled");
}

// LISTEN right away rather than on the first stream, so the realtime
// self-check in the logs tells after a deploy whether instances hear each
// other.
hub.start();

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

app.get("*", (c) => handler(c.req.raw));

serve({ fetch: app.fetch, hostname: "0.0.0.0", port: env.port }, (info) => {
  logger.info({ address: info.address, port: info.port }, "Server running");
});
