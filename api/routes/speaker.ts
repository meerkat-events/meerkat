import { jwt } from "@hono/hono/jwt";
import env from "../env.ts";
import { HTTPException } from "@hono/hono/http-exception";
import { getUserByUID, ZUPASS_PROVIDER } from "../models/user.ts";
import { getEventPods } from "../models/events.ts";
import { getAccounts } from "../models/user.ts";
import { Hono } from "@hono/hono";
import { COOKIE_NAME } from "../utils/cookie.ts";

const app = new Hono();

app.get(
  "/api/v1/speaker/pods",
  jwt({ secret: env.secret, cookie: COOKIE_NAME }),
  async (c) => {
    const payload = c.get("jwtPayload");
    const user = await getUserByUID(payload.sub);

    if (!user) {
      throw new HTTPException(401, { message: "User not found" });
    }

    const accounts = await getAccounts(user.id);
    const zuPass = accounts.find((account) =>
      account.provider === ZUPASS_PROVIDER
    );

    if (!zuPass?.hash) {
      throw new HTTPException(401, {
        message: `User ${user.uid} has not verified their email`,
      });
    }

    const speaker = await fetchSpeaker(zuPass.hash);

    const eventUids = speaker.sessions.map((session) => session.sourceId);
    const pods = await getEventPods(eventUids);

    const apiPods = pods.map(
      ({
        userId: _userId,
        eventId: _eventId,
        event: {
          id: __id,
          secret: __secret,
          ...eventRest
        },
        ...rest
      }) => ({
        ...rest,
        event: eventRest,
      }),
    );

    return c.json({
      data: apiPods,
    });
  },
);

type DevconSpeaker = {
  sessions: {
    sourceId: string;
  }[];
};

async function fetchSpeaker(speakerHash: string): Promise<DevconSpeaker> {
  const response = await fetch(
    `https://api.devcon.org/speakers/${speakerHash}`,
    {
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new HTTPException(401, {
      message: `Failed to fetch speaker with hash ${speakerHash}`,
    });
  }

  const { data: speaker } = await response.json();
  return speaker;
}

export default app;
