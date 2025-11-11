import { useQuestionsSubscription } from "../hooks/use-questions-subscription.ts";
import { useParams } from "react-router";
import { useCallback, useMemo } from "react";
import throttle from "lodash.throttle";
import { useLiveEventSubscription } from "../hooks/use-live-event-subscription.ts";
import { useLiveEvent } from "../hooks/use-live-event.ts";
import Presenter from "../components/Presenter/index.tsx";
import { toEvent } from "../lib/event.ts";

const REFRESH_INTERVAL = 30_000;

export default function Conference() {
  const { conferenceId } = useParams();

  const { data: eventData, mutate: refreshEvent } = useLiveEvent({
    conferenceId: conferenceId ? parseInt(conferenceId) : undefined,
    swr: { refreshInterval: REFRESH_INTERVAL },
  });

  const event = useMemo(() => eventData ? toEvent(eventData) : undefined, [
    eventData,
  ]);

  const throttleRefresh = useCallback(
    throttle(refreshEvent, 300),
    [refreshEvent],
  );

  useQuestionsSubscription(event, {
    onUpdate: throttleRefresh,
  });

  useLiveEventSubscription(event, {
    onUpdate: throttleRefresh,
  });

  return (
    <Presenter
      event={event}
      url={event ? getConferenceUrl(event.conference.id) : undefined}
    />
  );
}

function getConferenceUrl(conferenceId: number): URL {
  return new URL(
    `${import.meta.env.VITE_API_URL}/api/v1/conferences/${conferenceId}/live`,
  );
}
