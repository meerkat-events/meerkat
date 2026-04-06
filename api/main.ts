import "./instrumentation.ts";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createRequestHandler, type ServerBuild } from "react-router";
import app from "./app.ts";
import logger from "./logger.ts";

// @ts-expect-error - generated React Router build output has no TypeScript declarations
const build =
  (await import("./build/server/index.js")) as unknown as ServerBuild;
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

serve({ fetch: app.fetch, hostname: "0.0.0.0", port: 8000 }, (info) => {
  logger.info({ address: info.address, port: info.port }, "Server running");
});
