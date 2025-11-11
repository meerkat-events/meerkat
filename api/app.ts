import { Hono } from "@hono/hono";
import { logger } from "@hono/hono/logger";
import conferences from "./routes/conferences.ts";
import users from "./routes/users.ts";
import events from "./routes/events.ts";
import questions from "./routes/questions.ts";
import { config } from "./models/config.ts";

const app = new Hono();

app.use(logger());
app.route("/", conferences);
app.route("/", users);
app.route("/", events);
app.route("/", questions);

app.get("/api/v1/config", (c) => c.json(config));

export default app;
