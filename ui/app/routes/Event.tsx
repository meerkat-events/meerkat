import QR from "~/components/QR";
import { Heading, Text } from "@chakra-ui/react";
import TopQuestions from "~/components/TopQuestions";
import { useReactionsSubscription } from "~/hooks/use-reactions-subscription";
import { HeartIcon } from "~/components/assets/heart";
import { useQuestionsSubscription } from "~/hooks/use-questions-subscription";
import { useParams, useSearchParams } from "react-router";
import { useCallback, useMemo, useState } from "react";
import type { Event } from "~/types";
import { useEvent } from "~/hooks/use-event.ts";
import { randomNormal } from "d3-random";
import throttle from "lodash.throttle";

import "./index.css";

const REFRESH_INTERVAL = 30_000;

const randomX = randomNormal(50, 8);

export default function EventPage() {
  const { uid } = useParams();
  const [searchParams] = useSearchParams();
  const [reactions, setReactions] = useState<{ id: string; x: number }[]>([]);

  const hideQRCode = searchParams.get("hide-qr-code") === "true";

  const {
    data: eventData,
    mutate: refreshEvent,
  } = useEvent(uid, {
    swr: {
      refreshInterval: REFRESH_INTERVAL,
    },
  });

  const event = useMemo(() => eventData ? toEvent(eventData) : undefined, [
    eventData,
  ]);

  const addReaction = useCallback(() => {
    const id = globalThis.crypto.randomUUID();
    const x = Math.max(0, Math.min(100, randomX()));

    setReactions((prev) => [...prev, { id, x }]);

    setTimeout(() => {
      setReactions((prev) => prev.filter((reaction) => reaction.id !== id));
    }, 3000);
  }, []);

  useReactionsSubscription(event, {
    onUpdate: addReaction,
  });

  const throttleRefresh = useCallback(
    throttle(refreshEvent, 300),
    [refreshEvent],
  );

  useQuestionsSubscription(event, {
    onUpdate: throttleRefresh,
  });

  return (
    <div className={`page ${hideQRCode ? "hide-qr-code" : ""}`}>
      <header>
        <div className="title">
          <Heading as="h1" size="2xl">
            {event?.title}
          </Heading>
          <Text fontSize="xl">
            {event?.speaker}
          </Text>
        </div>
        <div className="logo">
          <img src="/logo.png" alt="Logo" width={30} height={30} />
          <Text className="font-family-meerkat" fontSize="sm" fontWeight="bold">
            meerkat.events
          </Text>
        </div>
      </header>
      <main>
        <TopQuestions questions={event?.questions ?? []} />
      </main>
      <aside>
        {!hideQRCode && event && <QR url={event.url} />}
        <Text fontSize="xl" fontWeight="bold" textAlign="center">
          Participants {event?.participants}
        </Text>
      </aside>

      <div className="reactions-container">
        {reactions.map((reaction) => (
          <div
            key={reaction.id}
            className="reaction"
            style={{ left: `${reaction.x}%` }}
            dangerouslySetInnerHTML={{ __html: HeartIcon }}
          />
        ))}
      </div>
    </div>
  );
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
