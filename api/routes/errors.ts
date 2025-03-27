import { HTTPException } from "@hono/hono/http-exception";
import { Event } from "../models/events.ts";

const endBuffer = 1000 * 60 * 60 * 24; // 1 day

export const checkEventEnded = (event: Event) => {
  const bufferedEndTime = event.end.getTime() + endBuffer;

  if (bufferedEndTime < Date.now()) {
    throw new HTTPException(403, {
      message: `Event ended on ${
        event.end.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      }`,
    });
  }
};
