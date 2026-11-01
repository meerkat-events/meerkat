import { data } from "react-router";
import { getConferenceThemeByEventUID } from "../../models/conferences.ts";
import type { Theme } from "../types.ts";

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
