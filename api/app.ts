import { Hono } from "@hono/hono";
import { serveStatic } from "@hono/hono/deno";
import { logger } from "@hono/hono/logger";
import conferences from "./routes/conferences.ts";
import users from "./routes/users.ts";
import events from "./routes/events.ts";
import questions from "./routes/questions.ts";
import { config } from "./models/config.ts";
import speaker from "./routes/speaker.ts";

const app = new Hono();

app.use(logger());
app.route("/", conferences);
app.route("/", users);
app.route("/", events);
app.route("/", questions);
app.route("/", speaker);

app.get("/api/v1/config", (c) => {
  return c.json(config);
});

app.get("/", serveStatic({ path: "./public/index.html" }));
app.get(
  "/leaderboard",
  serveStatic({ path: "./public/leaderboard/index.html" }),
);
app.get("/speaker", serveStatic({ path: "./public/speaker/index.html" }));
app.get("/login", serveStatic({ path: "./public/login/index.html" }));

app.get("/e/:uid", serveStatic({ path: "./public/index.html" }));
app.get("/e/:uid/*", serveStatic({ path: "./public/index.html" }));

app.use("*", serveStatic({ root: "./public" }));
export default app;
