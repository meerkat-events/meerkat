import { Hono } from "hono";
import env from "../env.ts";
import { getConferences } from "../models/conferences.ts";
import { HTTPException } from "hono/http-exception";
import { getLiveEvent } from "../models/events.ts";
import { getLeaderboard, SCORING } from "../models/leaderboard.ts";

const app = new Hono();

app.get("/api/v1/conferences", async (c) => {
  const conferences = await getConferences();
  return c.json({ data: conferences });
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

app.get("/api/v1/conferences/:id/leaderboard", async (c) => {
  const conferenceId = parseInt(c.req.param("id"));
  if (Number.isInteger(conferenceId) === false) {
    throw new HTTPException(400, {
      message: `Invalid conference id ${conferenceId}`,
    });
  }

  const entries = await getLeaderboard(conferenceId);

  return c.json({
    data: entries.map(({ userId: _userId, user, ...rest }) => ({
      ...rest,
      user: {
        id: user.id,
        name: user.userMetadata?.["name"] ?? user.id,
      },
    })),
    scoring: SCORING,
  });
});

export default app;
