import { useQuestionsSubscription } from "../hooks/use-questions-subscription.ts";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useCallback, useMemo } from "react";
import { useEvent } from "~/hooks/use-event.ts";
import throttle from "lodash.throttle";
import Presenter from "../components/Presenter/index.tsx";
import { toEvent } from "../lib/event.ts";
import { useKeepLive } from "../hooks/use-keep-live.ts";

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

  useKeepLive({
    event: keepLive ? event : undefined,
    onUpdate: (newEvent) => {
      const searchParams = new URLSearchParams();
      searchParams.set("keep-live", "true");
      navigate(`/e/${newEvent.uid}?${searchParams.toString()}`);
    },
  });

  const throttleRefresh = useCallback(
    throttle(refreshEvent, 300),
    [refreshEvent],
  );

  useQuestionsSubscription(event, {
    onUpdate: throttleRefresh,
  });

  return <Presenter event={event} url={event?.url} />;
}
