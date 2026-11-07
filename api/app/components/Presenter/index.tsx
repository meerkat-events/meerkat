import QR from "../QR.tsx";
import { Logo } from "../Logo.tsx";
import { Heading, Text } from "@chakra-ui/react";
import TopQuestions from "../TopQuestions.tsx";
import HighEngagementQuestions from "./HighEngagementQuestions.tsx";
import { eventStreamEvents, useEventSource } from "@meerkat-events/react";
import { ReactionGlyph } from "../QnA/ReactionGlyph.tsx";
import { useSearchParams } from "react-router";
import { useState, useSyncExternalStore } from "react";
import { apiUrl, appOrigin } from "../../lib/api-url.ts";
import { splitAnswering } from "../../lib/questions.ts";
import { qa } from "../../routing.ts";
import type { Event } from "../../types.ts";
import { type ReactionEmoji, toReactionEmoji } from "../../../reactions.ts";

import "./styles.css";

/**
 * A normally distributed random number (the Box-Muller transform), for
 * where a reaction floats up: clustered around the middle of the screen.
 */
function randomNormal(mean: number, deviation: number) {
  // 1 - random() is in (0, 1]: the logarithm of 0 would be -Infinity.
  const radius = Math.sqrt(-2 * Math.log(1 - Math.random()));
  const angle = 2 * Math.PI * Math.random();
  return mean + deviation * radius * Math.cos(angle);
}

/** The page's origin never changes: nothing to subscribe to. */
function subscribeToNothing() {
  return () => {};
}

/** Few enough questions to read from the back of the room. */
const MAX_QUESTIONS = 5;

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
  const url = origin ? new URL(qa(event.uid), origin).toString() : undefined;
  const [reactions, setReactions] = useState<
    { id: string; x: number; emoji: ReactionEmoji }[]
  >([]);

  const hideQRCode = searchParams.get("hide-qr-code") === "true";

  const addReaction = (emoji: ReactionEmoji) => {
    const id = globalThis.crypto.randomUUID();
    // Percent of the screen's width
    const x = Math.max(0, Math.min(100, randomNormal(50, 8)));

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
  const { answering, others } = splitAnswering(allQuestions);
  const shownQuestions = (answering ? [answering, ...others] : others)
    .slice(0, MAX_QUESTIONS);
  // In high engagement mode the question being answered is the only open
  // one on screen.
  const moreCount = event.highEngagement
    ? others.length
    : allQuestions.length - shownQuestions.length;

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
        {event.highEngagement
          ? (
            <HighEngagementQuestions
              answering={answering}
              // Missing from servers older than high engagement mode, which
              // a new client can still reach while a deploy rolls out.
              recentlyAnswered={event.recentlyAnswered ?? []}
              showsQRCode={!hideQRCode}
            />
          )
          : <TopQuestions questions={shownQuestions} answering={answering} />}
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
        {reactions.map((reaction) => (
          <div
            key={reaction.id}
            className="reaction"
            style={{ left: `${reaction.x}%` }}
          >
            <ReactionGlyph emoji={reaction.emoji} />
          </div>
        ))}
      </div>
    </div>
  );
}
