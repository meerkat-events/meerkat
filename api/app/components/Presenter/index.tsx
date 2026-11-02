import QR from "../QR.tsx";
import { Logo } from "../Logo.tsx";
import { Heading, Text } from "@chakra-ui/react";
import TopQuestions from "../TopQuestions.tsx";
import { eventStreamEvents, useEventSource } from "@meerkat-events/react";
import { HeartIcon } from "../assets/heart.ts";
import { useSearchParams } from "react-router";
import { useMemo, useState, useSyncExternalStore } from "react";
import { apiUrl, appOrigin } from "../../lib/api-url.ts";
import { qa } from "../../routing.ts";
import type { Event } from "../../types.ts";
import {
  REACTION_GLYPHS,
  type ReactionEmoji,
  toReactionEmoji,
} from "../../../reactions.ts";
import { randomNormal } from "d3-random";

import "./styles.css";

const randomX = randomNormal(50, 8);

/** The page's origin never changes: nothing to subscribe to. */
function subscribeToNothing() {
  return () => {};
}

/** Few enough questions to read from the back of the room. */
const MAX_QUESTIONS = 5;

/** The top questions, always including the one being answered. */
function topQuestions<Q extends { selectedAt?: unknown }>(questions: Q[]) {
  const top = questions.slice(0, MAX_QUESTIONS);
  const selected = questions.find((question) => question.selectedAt);
  if (!selected || top.includes(selected)) {
    return top;
  }
  return [selected, ...top.slice(0, MAX_QUESTIONS - 1)];
}

export type PresenterProps = {
  event: Event;
  /** Called when the event's questions or votes change. */
  onQuestionsChanged: () => void;
  /** Called with the uid of an event just put live on this event's stage. */
  onEventLive?: ((eventUid: string) => void) | undefined;
};

export default function Presenter(
  { event, onQuestionsChanged, onEventLive }: PresenterProps,
) {
  const [searchParams] = useSearchParams();
  // The Q&A link for the QR code, which is drawn in the browser: only the
  // browser knows the origin it was served from.
  const origin = useSyncExternalStore(
    subscribeToNothing,
    appOrigin,
    () => undefined,
  );
  const url = useMemo(
    () => origin ? new URL(qa(event.uid), origin) : undefined,
    [origin, event.uid],
  );
  const [reactions, setReactions] = useState<
    { id: string; x: number; emoji: ReactionEmoji }[]
  >([]);

  const hideQRCode = searchParams.get("hide-qr-code") === "true";

  const addReaction = (emoji: ReactionEmoji) => {
    const id = globalThis.crypto.randomUUID();
    const x = Math.max(0, Math.min(100, randomX()));

    setReactions((prev) => [...prev, { id, x, emoji }]);

    setTimeout(() => {
      setReactions((prev) => prev.filter((reaction) => reaction.id !== id));
    }, 3000);
  };

  // One stream for everything: question changes refetch the event, reactions
  // float up on the screen, and another event going live on the stage
  // switches the screen to it.
  useEventSource({
    url: apiUrl(`/api/v1/events/${event.uid}/questions/stream`),
    onMessage: onQuestionsChanged,
    events: eventStreamEvents({
      onReaction: (reaction) => addReaction(toReactionEmoji(reaction.emoji)),
      onEventLive: (session) => onEventLive?.(session.uid),
    }),
  });

  const allQuestions = event.questions;
  const shownQuestions = topQuestions(allQuestions);
  const moreCount = allQuestions.length - shownQuestions.length;

  return (
    <div className={`page ${hideQRCode ? "hide-qr-code" : ""}`}>
      <header>
        <div className="title">
          <Heading as="h1" size="3xl">
            {event.title}
          </Heading>
        </div>
      </header>
      <main>
        <TopQuestions questions={shownQuestions} />
      </main>
      <footer>
        <span className="footer-logo">
          <Logo height="2.75rem" width="auto" />
        </span>
        {moreCount > 0 && (
          <Text className="more-questions" fontSize="xl" fontWeight="bold">
            +{moreCount} more {moreCount === 1 ? "question" : "questions"}
          </Text>
        )}
        <Text className="font-family-meerkat" fontSize="2xl" fontWeight="bold">
          meerkat.events
        </Text>
      </footer>
      {!hideQRCode && url && (
        <aside>
          <div className="qr-code-group">
            <QR url={url} />
            <Text fontSize="xl" fontWeight="bold" textAlign="center">
              Scan to ask
            </Text>
          </div>
        </aside>
      )}

      <div className="reactions-container">
        {reactions.map((reaction) =>
          reaction.emoji === "heart"
            ? (
              <div
                key={reaction.id}
                className="reaction"
                style={{ left: `${reaction.x}%` }}
                dangerouslySetInnerHTML={{ __html: HeartIcon }}
              />
            )
            : (
              <div
                key={reaction.id}
                className="reaction reaction-emoji"
                style={{ left: `${reaction.x}%` }}
              >
                {REACTION_GLYPHS[reaction.emoji]}
              </div>
            )
        )}
      </div>
    </div>
  );
}
