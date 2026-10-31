import { useNavigate, useParams, useSearchParams } from "react-router";
import { useMemo } from "react";
import { useJitteredRefresh } from "@meerkat-events/react";
import { useEvent } from "~/hooks/use-event.ts";
import Presenter from "../components/Presenter/index.tsx";
import { toEvent } from "../lib/event.ts";
import { useKeepLive } from "../hooks/use-keep-live.ts";

// The stage screen refetches the whole event on an SSE update, paced like
// every other client (useJitteredRefresh: one refetch at a time), within a
// second.
const REFRESH_MAX_DELAY_MS = 1000;

export default function EventPage() {
  const { uid } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const keepLive = searchParams.get("keep-live") === "true";

  const {
    data,
    mutate: refreshEvent,
  } = useEvent(uid, {
    swr: {
      refreshInterval: 10_000,
    },
  });

  const event = useMemo(() => data?.data ? toEvent(data.data) : undefined, [
    data?.data,
  ]);

  // In keep-live mode the screen follows the stage: right away when a
  // moderator puts another event live (the stream's `live` message), and
  // through useKeepLive's 10-second poll when the schedule moves on.
  const goToEvent = (eventUid: string) => {
    if (eventUid === event?.uid) return;
    const searchParams = new URLSearchParams();
    searchParams.set("keep-live", "true");
    navigate(`/e/${eventUid}?${searchParams.toString()}`);
  };

  useKeepLive({
    event: keepLive ? event : undefined,
    onUpdate: (newEvent) => goToEvent(newEvent.uid),
  });

  const scheduleRefresh = useJitteredRefresh(
    () => refreshEvent(),
    REFRESH_MAX_DELAY_MS,
  );

  return (
    <Presenter
      event={event}
      url={event?.url}
      onQuestionsChanged={scheduleRefresh}
      onEventLive={keepLive ? goToEvent : undefined}
    />
  );
}
