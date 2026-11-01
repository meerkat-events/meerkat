import { Hono } from "hono";
import { cors } from "hono/cors";
import conferences from "./routes/conferences.ts";
import users from "./routes/users.ts";
import events from "./routes/events.ts";
import questions from "./routes/questions.ts";
import admin from "./routes/admin.ts";
import pretalx from "./routes/pretalx.ts";
import posthogProxy from "./routes/posthog-proxy.ts";
import { pingDatabase } from "./models/health.ts";
import env from "./env.ts";
import logger from "./logger.ts";
import { HTTPException } from "hono/http-exception";
import { requestLogger } from "./middlewares/request-logger.ts";
import { telemetry } from "./middlewares/telemetry.ts";
import { reportException } from "./posthog.ts";

const app = new Hono();

// Before the middlewares below, which it skips: it answers without calling
// them, and the browser's PostHog requests don't belong in our own logs and
// traces.
app.route("/", posthogProxy);
// First, so the request log line and everything after it is linked to the
// browser's PostHog session.
app.use(telemetry());
app.use(requestLogger());
// Browser clients on other origins (e.g. `@meerkat-events/react` embedded in
// the Devcon event app) need CORS headers on every /api response, including
// the SSE stream and error responses. Preflights are answered here with 204.
app.use(
  "/api/*",
  cors({
    origin: env.corsOrigins,
    maxAge: 86400,
    // Lets a frontend on another origin read how long a 429 lasts.
    exposeHeaders: ["Retry-After"],
  }),
);
app.route("/", conferences);
app.route("/", users);
app.route("/", events);
app.route("/", questions);
app.route("/", admin);
app.route("/", pretalx);

// Fly's health check (fly.template.toml): public, cheap, and failing while
// the database is unreachable.
app.get("/api/v1/health", async (c) => {
  await pingDatabase();
  return c.json({ data: { status: "ok" } });
});

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  logger.error(
    { err, method: c.req.method, path: c.req.path },
    "Unhandled error",
  );
  reportException(err);
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
