import { Hono } from "@hono/hono";
import { zValidator } from "@hono/zod-validator";
import zod from "zod";
import { apiKey } from "../middlewares/api-key.ts";
import { upsertEvents } from "../models/events.ts";

const app = new Hono();

const batchUpsertEventsSchema = zod.array(
  zod.object({
    conferenceId: zod.number(),
    uid: zod.string().min(1),
    title: zod.string().min(1),
    stage: zod.string().min(1),
    start: zod.string().or(zod.date()).transform((val) =>
      typeof val === "string" ? new Date(val) : val
    ),
    end: zod.string().or(zod.date()).transform((val) =>
      typeof val === "string" ? new Date(val) : val
    ),
    description: zod.string().optional(),
    cover: zod.string().optional(),
    speaker: zod.string().optional(),
  }),
);

app.post(
  "/api/v1/admin/events",
  apiKey(),
  zValidator("json", batchUpsertEventsSchema),
  async (c) => {
    const events = c.req.valid("json");
    let results: unknown = [];

    if (events.length > 0) {
      results = await upsertEvents(events);
    }

    return c.json({ data: results });
  },
);

export default app;
