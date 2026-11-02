import { useEffect } from "react";
import { useJitteredRefresh } from "@meerkat-events/react";
import Presenter from "../components/Presenter/index.tsx";
import { usePresenterEvent } from "../hooks/use-presenter-event.ts";
import { useStageLiveEvent } from "../hooks/use-stage-live-event.ts";
import { getStagePresenterEvent } from "../lib/presenter-event.server.ts";
import type { Route } from "./+types/Stage.ts";

// The stage screen's pacing of refetches (CLAUDE.md, Real-time).
const STAGE_REFRESH_MAX_DELAY_MS = 1000;

// The server renders the event the stage shows, with its questions: a
// reload shows them at once, without a loading state.
export async function loader({ params }: Route.LoaderArgs) {
  return { event: await getStagePresenterEvent(params["stage"]) };
}

/**
 * The stage screen: the presenter view of the event the stage shows (live,
 * else running, else next, else the one that ended last), at `/stage/:stage`.
 * It notices another event within a second when a moderator puts one live
 * (the stream's `live` message) and through useStageLiveEvent's 30-second
 * poll when the schedule moves on, and then reloads the page, so the next
 * event starts fresh: its conference's theme, its stream, no state of the
 * previous one. The screen's options (e.g. `hide-qr-code=true`) stay in the
 * URL.
 */
export default function StagePage({ params, loaderData }: Route.ComponentProps) {
  // The event this page load shows: the one the server rendered.
  const { event, scheduleRefresh } = usePresenterEvent(loaderData.event);

  // The server just looked the stage up: the first lookup here is the poll's.
  const { data, mutate: refreshStage } = useStageLiveEvent(params["stage"], {
    swr: { revalidateOnMount: false },
  });
  const stageEventUid = data?.data.uid;

  useEffect(() => {
    if (stageEventUid && stageEventUid !== event.uid) {
      globalThis.location.reload();
    }
  }, [stageEventUid, event.uid]);

  // Every screen of the stage hears the `live` message at once: spread
  // their lookups out like every other refetch.
  const scheduleStageRefresh = useJitteredRefresh(
    () => refreshStage(),
    STAGE_REFRESH_MAX_DELAY_MS,
  );

  return (
    <Presenter
      event={event}
      onQuestionsChanged={scheduleRefresh}
      onEventLive={scheduleStageRefresh}
    />
  );
}
