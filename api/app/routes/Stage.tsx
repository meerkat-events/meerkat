import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { useJitteredRefresh } from "@meerkat-events/react";
import Presenter from "../components/Presenter/index.tsx";
import { usePresenterEvent } from "../hooks/use-presenter-event.ts";
import { useStageLiveEvent } from "../hooks/use-stage-live-event.ts";

// The stage screen's pacing of refetches (CLAUDE.md, Real-time).
const STAGE_REFRESH_MAX_DELAY_MS = 1000;

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
export default function StagePage() {
  const { stage } = useParams();
  const { data, mutate: refreshStage } = useStageLiveEvent(stage);
  const stageEventUid = data?.data.uid;

  // The event this page load shows: the first one the stage lookup returns.
  const [shownUid, setShownUid] = useState<string>();
  if (stageEventUid && !shownUid) {
    setShownUid(stageEventUid);
  }
  useEffect(() => {
    if (shownUid && stageEventUid && stageEventUid !== shownUid) {
      globalThis.location.reload();
    }
  }, [stageEventUid, shownUid]);

  const { event, scheduleRefresh } = usePresenterEvent(shownUid);

  // Every screen of the stage hears the `live` message at once: spread
  // their lookups out like every other refetch.
  const scheduleStageRefresh = useJitteredRefresh(
    () => refreshStage(),
    STAGE_REFRESH_MAX_DELAY_MS,
  );

  return (
    <Presenter
      event={event}
      url={event?.url}
      onQuestionsChanged={scheduleRefresh}
      onEventLive={scheduleStageRefresh}
    />
  );
}
