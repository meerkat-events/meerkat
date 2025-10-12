import { useQuestionsSubscription } from "~/hooks/use-questions-subscription";
import { useParams } from "react-router";
import { useCallback, useMemo } from "react";
import type { Event } from "~/types";
import { useEvent } from "~/hooks/use-event.ts";
import throttle from "lodash.throttle";
import { useLiveEventSubscription } from "~/hooks/use-live-event-subscription";
import Presenter from "~/components/Presenter";

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

  return <Presenter event={event} />;
}

function toEvent(data: Event) {
  return {
    ...data,
    start: new Date(data.start),
    end: new Date(data.end),
    url: new URL(`${import.meta.env.VITE_API_URL}/e/${data.uid}/remote`),
    questions: data.questions.map((question) => ({
      ...question,
      createdAt: new Date(question.createdAt),
      answeredAt: question.answeredAt
        ? new Date(question.answeredAt)
        : undefined,
    })),
  };
}
