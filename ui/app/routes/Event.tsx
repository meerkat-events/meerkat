import QR from "~/components/QR";
import { Heading, Text } from "@chakra-ui/react";
import TopQuestions from "~/components/TopQuestions";
import { useReactionsSubscription } from "~/hooks/use-reactions-subscription";
import { HeartIcon } from "~/components/assets/heart";
import { useQuestionsSubscription } from "~/hooks/use-questions-subscription";
import { useQuestions } from "~/hooks/use-questions";
import { useParams, useSearchParams } from "react-router";
import { useMemo } from "react";
import { useThrottle } from "@uidotdev/usehooks";
import type { Event } from "~/types";
import { useEvent } from "~/hooks/use-event.ts";

import "./index.css";

const REFRESH_INTERVAL = 30_000;

export default function EventPage() {
  const { uid } = useParams();
  const [searchParams] = useSearchParams();

  const hideQRCode = searchParams.get("hide-qr-code") === "true";

  const {
    data: questions,
    mutate: refreshQuestions,
  } = useQuestions(
    uid,
    {
      sort: "popular",
      answered: false,
      swr: {
        refreshInterval: REFRESH_INTERVAL,
      },
    },
  );

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

  useReactionsSubscription(event, {
    onUpdate: (_reaction) => {
      const reactionElement = createReactionElement(HeartIcon);
      const parent = document.querySelector(".heart-icon-container");
      parent?.appendChild(reactionElement);
    },
  });

  const throttledRefresh = useThrottle(
    () => {
      refreshQuestions();
      refreshEvent();
    },
    300,
  );

  useQuestionsSubscription(event, {
    onUpdate: throttledRefresh,
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
        <TopQuestions questions={questions ?? []} />
      </main>
      <aside>
        {!hideQRCode && event && <QR url={event.url} />}
        <Text fontSize="xl" fontWeight="bold" textAlign="center">
          Participants {event?.participants}
        </Text>
      </aside>
    </div>
  );
}

function createReactionElement(icon: string) {
  const reactionElement = document.createElement("div");
  reactionElement.className = "reaction";
  reactionElement.style.right = `${Math.random() * 0.5 - 0.25}rem`;
  reactionElement.innerHTML = icon;

  return reactionElement;
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
