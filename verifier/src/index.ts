import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { verifyTicketProof } from "./verify.js";
import process from "node:process";

const app = new Hono();
const port = process.env.PORT || "8080";

app.use(logger());

app.post("/verify", async (c) => {
  const ticketProof = await c.req.json();
  const verified = await verifyTicketProof(ticketProof);
  return c.json({ data: { verified } });
});

app.get("/", (c) => {
  return c.json({ message: "Hello World" });
});

console.info(`Server is running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port: Number.parseInt(port),
  hostname: "0.0.0.0",
});
