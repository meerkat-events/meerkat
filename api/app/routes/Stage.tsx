import { useParams } from "react-router";
import Presenter from "../components/Presenter/index.tsx";
import { usePresenterEvent } from "../hooks/use-presenter-event.ts";
import { useStageLiveEvent } from "../hooks/use-stage-live-event.ts";

/**
 * The stage screen: the presenter view of the event the stage shows (live,
 * else running, else next, else the one that ended last), switching events
 * without leaving `/stage/:stage`. It follows the stage right away when a
 * moderator puts another event live (the stream's `live` message) and
 * through useStageLiveEvent's 10-second poll when the schedule moves on. The
 * screen's options (e.g. `hide-qr-code=true`) stay in the URL.
 */
export default function StagePage() {
  const { stage } = useParams();
  const { data, mutate: refreshStage } = useStageLiveEvent(stage);
  const { event, scheduleRefresh } = usePresenterEvent(data?.data.uid);

  return (
    <Presenter
      event={event}
      url={event?.url}
      onQuestionsChanged={scheduleRefresh}
      onEventLive={() => refreshStage()}
    />
  );
}
