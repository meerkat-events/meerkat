import QR from "~/components/QR";
import TopQuestions from "~/components/TopQuestions";
import { useReactionsSubscription } from "~/hooks/use-reactions-subscription";
import { HeartIcon } from "~/components/assets/heart";
import { useQuestionsSubscription } from "~/hooks/use-questions-subscription";
import { useQuestions } from "~/hooks/use-questions";
import { useParams } from "react-router";
import type { Route } from "./+types/Event.tsx";
import type { Event, Question } from "~/types";

import "./index.css";

type JSONQuestion = Omit<Question, "answeredAt" | "createdAt"> & {
  answeredAt: string | undefined;
  createdAt: string;
};

type JSONEvent = Omit<Event, "start" | "end"> & {
  start: string;
  end: string;
  questions: JSONQuestion[];
};

export async function clientLoader({ params }: Route.LoaderArgs) {
  const url = new URL(
    `${import.meta.env.VITE_API_URL}/api/v1/events/${params.uid}`,
  );
  const event = await fetch(url, {
    headers: {
      accept: "application/json",
    },
  });

  if (!event.ok) {
    throw new Response("Not found", { status: 404 });
  }

  const { data } = await event.json() as { data: JSONEvent };

  return {
    ...data,
    start: new Date(data.start),
    end: new Date(data.end),
    url: new URL(`${import.meta.env.VITE_API_URL}/e/${params.uid}/remote`),
    questions: data.questions.map((question) => ({
      ...question,
      createdAt: new Date(question.createdAt),
      answeredAt: question.answeredAt
        ? new Date(question.answeredAt)
        : undefined,
    })),
  };
}

export default function Event(
  { loaderData }: Route.ComponentProps,
) {
  const { uid } = useParams();
  const event = loaderData;
  const { participants, conference } = loaderData;

  const {
    data: questions,
    mutate: refreshQuestions,
  } = useQuestions(
    uid,
    "popular",
  );

  const refresh = () => {
    refreshQuestions();
  };

  useReactionsSubscription(event, {
    onUpdate: (_reaction) => {
      const reactionElement = createReactionElement(HeartIcon);
      const parent = document.querySelector(".heart-icon-container");
      parent?.appendChild(reactionElement);
    },
  });

  useQuestionsSubscription(event, {
    onUpdate: () => {
      refresh();
    },
  });

  return (
    <div className="layout">
      <div className="top-questions-container">
        <TopQuestions
          questions={questions ?? []}
          participants={participants}
        />
      </div>
      <div className="qr-container">
        <QR url={event.url} event={event} conferenceName={conference.name} />
      </div>
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
