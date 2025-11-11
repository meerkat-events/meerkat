import { useQuestionsSubscription } from "../hooks/use-questions-subscription.ts";
import { useParams } from "react-router";
import { useCallback, useMemo } from "react";
import { useEvent } from "~/hooks/use-event.ts";
import throttle from "lodash.throttle";
import { useLiveEventSubscription } from "../hooks/use-live-event-subscription.ts";
import Presenter from "../components/Presenter/index.tsx";
import { toEvent } from "../lib/event.ts";

const REFRESH_INTERVAL = 30_000;

export default function EventPage() {
  const { uid } = useParams();

  const {
    data: eventByUid,
    mutate: refreshEvent,
  } = useEvent(uid, {
    swr: {
      refreshInterval: REFRESH_INTERVAL,
    },
  });

  const event = useMemo(() => eventByUid ? toEvent(eventByUid) : undefined, [
    eventByUid,
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

  return <Presenter event={event} url={event?.url} />;
}
