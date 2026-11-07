import { data } from "react-router";
import {
  getConferenceThemeByEventUID,
  getConferenceThemeById,
} from "../../models/conferences.ts";
import { getStageLiveEvent } from "../../models/events.ts";
import type { Theme } from "../../conference-theme.ts";

/**
 * The theme of the event's conference, for the layouts' `loader`; null when
 * the conference has none (the default Meerkat theme). Throws a 404 response
 * for an unknown event, which the layout's ErrorBoundary shows.
 */
export async function getEventTheme(uid: string): Promise<Theme | null> {
  const result = await getConferenceThemeByEventUID(uid);
  if (!result) {
    throw data(null, { status: 404 });
  }
  return result.theme;
}

/**
 * The theme of the conference of the event the stage shows, for the stage
 * screen (`/stage/:stage`). Throws a 404 response for a stage without events;
 * that page doesn't recover until it is reloaded.
 */
export async function getStageTheme(stage: string): Promise<Theme | null> {
  const event = await getStageLiveEvent(stage);
  const result = event ? await getConferenceThemeById(event.conferenceId) : null;
  if (!result) {
    throw data(null, { status: 404 });
  }
  return result.theme;
}
