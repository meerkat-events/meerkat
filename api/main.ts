import "./instrumentation.ts";
import app from "./app.ts";
import reactRouterApp from "./react-router.production.ts";

app.route("/", reactRouterApp);

Deno.serve({
  hostname: "0.0.0.0",
}, app.fetch);
