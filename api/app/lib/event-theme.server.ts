import { data } from "react-router";
import { getConferenceById } from "../../models/conferences.ts";
import { getEventByUID } from "../../models/events.ts";
import type { Theme } from "../types.ts";

/**
 * The theme of the event's conference, for the layouts' `loader`; null when
 * the conference has none (the default Meerkat theme). Throws a 404 response
 * for an unknown event, which the layout's ErrorBoundary shows.
 */
export async function getEventTheme(uid: string): Promise<Theme | null> {
  const event = await getEventByUID(uid);
  if (!event) {
    throw data(null, { status: 404 });
  }

  const conference = await getConferenceById(event.conferenceId);
  return conference?.theme ?? null;
}
