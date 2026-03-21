import { Hono } from "@hono/hono";
import { logger as honoLogger } from "@hono/hono/logger";
import conferences from "./routes/conferences.ts";
import users from "./routes/users.ts";
import events from "./routes/events.ts";
import questions from "./routes/questions.ts";
import admin from "./routes/admin.ts";
import auth from "./routes/auth.ts";
import { config } from "./models/config.ts";
import logger from "./logger.ts";
import { HTTPException } from "@hono/hono/http-exception";

const app = new Hono();

app.use(honoLogger());
app.route("/", conferences);
app.route("/", users);
app.route("/", events);
app.route("/", questions);
app.route("/", admin);
app.route("/", auth);

app.get("/api/v1/config", (c) => c.json(config));

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  logger.error({ err }, "Unhandled error");
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
