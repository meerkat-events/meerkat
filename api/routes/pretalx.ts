import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import env from "../env.ts";
import logger from "../logger.ts";
import {
  PRETALX_EVENT_PATTERN,
  PretalxError,
  triggerPretalxSync,
} from "../pretalx.ts";

const app = new Hono();

// Unauthenticated on purpose: the caller supplies nothing, Meerkat only
// re-pulls the public schedule of a Pretalx event it already knows, and
// `claimPretalxSync` limits it to one sync per cooldown across instances.
app.post("/api/v1/pretalx/:event/sync", async (c) => {
  if (!env.pretalxUrl) {
    throw new HTTPException(503, { message: "Pretalx sync is not configured" });
  }
  const pretalxEvent = c.req.param("event");
  if (!PRETALX_EVENT_PATTERN.test(pretalxEvent)) {
    throw new HTTPException(400, {
      message: `Invalid Pretalx event ${pretalxEvent}`,
    });
  }

  let trigger;
  try {
    trigger = await triggerPretalxSync(pretalxEvent);
  } catch (err) {
    if (err instanceof PretalxError) {
      logger.error({ err, pretalxEvent }, "Pretalx sync failed");
      throw new HTTPException(502, { message: err.message });
    }
    throw err;
  }

  switch (trigger.status) {
    case "unknown":
      throw new HTTPException(404, {
        message: `No conference is linked to Pretalx event ${pretalxEvent}`,
      });
    case "queued":
      c.header("Retry-After", String(trigger.retryAfter));
      return c.json(
        { data: { queued: true, retryAfter: trigger.retryAfter } },
        202,
      );
    case "synced":
      return c.json({ data: trigger.result });
  }
});

export default app;
