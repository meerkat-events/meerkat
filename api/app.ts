import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import conferences from "./routes/conferences.ts";
import users from "./routes/users.ts";
import events from "./routes/events.ts";
import questions from "./routes/questions.ts";
import admin from "./routes/admin.ts";
import pretalx from "./routes/pretalx.ts";
import { config } from "./models/config.ts";
import env from "./env.ts";
import logger from "./logger.ts";
import { HTTPException } from "hono/http-exception";

const app = new Hono();

app.use(honoLogger());
// Browser clients on other origins (e.g. `@meerkat-events/react` embedded in
// the Devcon event app) need CORS headers on every /api response, including
// the SSE stream and error responses. Preflights are answered here with 204.
app.use(
  "/api/*",
  cors({
    origin: env.corsOrigins,
    maxAge: 86400,
  }),
);
app.route("/", conferences);
app.route("/", users);
app.route("/", events);
app.route("/", questions);
app.route("/", admin);
app.route("/", pretalx);

app.get("/api/v1/config", (c) => c.json(config));

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  logger.error({ err }, "Unhandled error");
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
