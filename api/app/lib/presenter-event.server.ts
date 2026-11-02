import { data } from "react-router";
import { getEventByUID, getStageLiveEvent } from "../../models/events.ts";
import { getPublicEvent } from "../../models/public-event.ts";
import type { Event } from "../types.ts";

/**
 * The event a presenter view shows, for the routes' `loader`: the server
 * renders the questions, and the browser starts from them instead of
 * fetching them again. It is the JSON `GET /api/v1/events/:uid` sends, so
 * the first render and every refetch see the same data. Throws a 404
 * response for an unknown event.
 */
export async function getPresenterEvent(uid: string | undefined) {
  const event = uid ? await getEventByUID(uid) : null;
  const publicEvent = event ? await getPublicEvent(event) : null;
  if (!publicEvent) {
    throw data(null, { status: 404 });
  }
  const json: Event = JSON.parse(JSON.stringify(publicEvent));
  return json;
}

/**
 * The event the stage screen (`/stage/:stage`) shows: live, else running,
 * else next, else the one that ended last. Throws a 404 response for a stage
 * without events.
 */
export async function getStagePresenterEvent(stage: string | undefined) {
  const stageEvent = stage ? await getStageLiveEvent(stage) : null;
  if (!stageEvent) {
    throw data(null, { status: 404 });
  }
  return await getPresenterEvent(stageEvent.uid);
}
