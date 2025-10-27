import { Hono } from "@hono/hono";
import { createRequestHandler } from "react-router";
import { serveStatic } from "@hono/hono/deno";

const rootDir = new URL(".", import.meta.url).pathname;

const handleRequest = createRequestHandler(
  await import(`${rootDir}build/server/index.js`),
  "production",
);

const app = new Hono();

app.get(
  "*",
  serveStatic({
    root: `${rootDir}/build/client`,
    onFound(path, c) {
      if (path.startsWith("/assets/")) {
        c.header("Cache-Control", "public, max-age=31536000, immutable");
      } else {
        c.header("Cache-Control", "public, max-age=600");
      }
    },
  }),
);

app.get("*", (c) => handleRequest(c.req.raw));

export default app;
