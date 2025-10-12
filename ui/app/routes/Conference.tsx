import { useQuestionsSubscription } from "~/hooks/use-questions-subscription";
import { useParams } from "react-router";
import { useCallback, useMemo } from "react";
import type { Event } from "~/types";
import throttle from "lodash.throttle";
import { useEventSubscription } from "~/hooks/use-event-subscription";
import { useLiveEvent } from "~/hooks/use-live-event";
import Presenter from "~/components/Presenter";

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

  useEventSubscription(event, {
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
