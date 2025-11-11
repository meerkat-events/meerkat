import { Hono } from "@hono/hono";
import env from "../env.ts";
import { getConferences, getTickets } from "../models/conferences.ts";
import { HTTPException } from "@hono/hono/http-exception";
import { getLiveEvent } from "../models/events.ts";

const app = new Hono();

app.get("/api/v1/conferences", async (c) => {
  const conferences = await getConferences();
  return c.json({ data: conferences });
});

app.get("/api/v1/conferences/:id/tickets", async (c) => {
  const conferenceId = parseInt(c.req.param("id"));
  if (Number.isInteger(conferenceId) === false) {
    throw new HTTPException(400, {
      message: `Invalid conference id ${conferenceId}`,
    });
  }

  const tickets = await getTickets(conferenceId);

  const clientTickets = tickets.map((ticket) => {
    return {
      collectionName: ticket.collectionName,
      signerPublicKey: ticket.signerPublicKey,
      eventId: ticket.eventId,
      productId: ticket.productId,
      role: ticket.role,
    };
  });

  return c.json({ data: clientTickets });
});

app.get("/api/v1/conferences/:id/live", async (c) => {
  const conferenceId = parseInt(c.req.param("id"));
  if (Number.isInteger(conferenceId) === false) {
    throw new HTTPException(400, {
      message: `Invalid conference id ${conferenceId}`,
    });
  }

  const liveEvent = await getLiveEvent(conferenceId);

  if (!liveEvent) {
    throw new HTTPException(404, {
      message: `No live event found for conference ${conferenceId}`,
    });
  }

  return c.redirect(new URL(`/e/${liveEvent.uid}/qa`, env.base));
});

export default app;
