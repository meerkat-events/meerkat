import { useNavigate, useSearchParams } from "react-router";
import Presenter from "../components/Presenter/index.tsx";
import { usePresenterEvent } from "../hooks/use-presenter-event.ts";
import { useKeepLive } from "../hooks/use-keep-live.ts";
import { stageScreenSearchParams } from "../../stage-screen.ts";
import { getPresenterEvent } from "../lib/presenter-event.server.ts";
import type { Route } from "./+types/Event.ts";

// The server renders the event with its questions: a reload shows them at
// once, without a loading state.
export async function loader({ params }: Route.LoaderArgs) {
  return { event: await getPresenterEvent(params["uid"]) };
}

export default function EventPage({ loaderData }: Route.ComponentProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const keepLive = searchParams.get("keep-live") === "true";

  const { event, scheduleRefresh } = usePresenterEvent(loaderData.event);

  // In keep-live mode the screen follows the stage: right away when a
  // moderator puts another event live (the stream's `live` message), and
  // through useKeepLive's 30-second poll when the schedule moves on.
  // /stage/:stage does the same without leaving its URL (Stage.tsx).
  const goToEvent = (eventUid: string) => {
    if (eventUid === event.uid) return;
    const nextSearchParams = stageScreenSearchParams(searchParams);
    navigate(`/e/${eventUid}?${nextSearchParams.toString()}`);
  };

  useKeepLive({
    event: keepLive ? event : undefined,
    onUpdate: (newEvent) => goToEvent(newEvent.uid),
  });

  return (
    <Presenter
      event={event}
      onQuestionsChanged={scheduleRefresh}
      onEventLive={keepLive ? goToEvent : undefined}
    />
  );
}
