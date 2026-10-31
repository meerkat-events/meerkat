import QR from "../QR.tsx";
import { Logo } from "../Logo.tsx";
import { Heading, Text } from "@chakra-ui/react";
import TopQuestions from "../TopQuestions.tsx";
import { useEventSource } from "@meerkat-events/react";
import { HeartIcon } from "../assets/heart.ts";
import { useSearchParams } from "react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { apiUrl } from "../../lib/api-url.ts";
import type { Event, Reaction } from "../../types.ts";
import { REACTION_GLYPHS, type ReactionEmoji } from "../../../reactions.ts";
import { randomNormal } from "d3-random";

import "./styles.css";

const randomX = randomNormal(50, 8);

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
  event: Event | undefined;
  url: URL | undefined;
  /** Called when the event's questions or votes change. */
  onQuestionsChanged: () => void;
  /** Called with the uid of an event just put live on this event's stage. */
  onEventLive?: ((eventUid: string) => void) | undefined;
};

export default function Presenter(
  { event, url, onQuestionsChanged, onEventLive }: PresenterProps,
) {
  const [searchParams] = useSearchParams();
  const [reactions, setReactions] = useState<
    { id: string; x: number; emoji: ReactionEmoji }[]
  >([]);

  const hideQRCode = searchParams.get("hide-qr-code") === "true";

  const addReaction = useCallback((reaction: Reaction) => {
    const id = globalThis.crypto.randomUUID();
    const x = Math.max(0, Math.min(100, randomX()));
    const emoji = reaction.emoji ?? "heart";

    setReactions((prev) => [...prev, { id, x, emoji }]);

    setTimeout(() => {
      setReactions((prev) => prev.filter((reaction) => reaction.id !== id));
    }, 3000);
  }, []);

  // One stream for everything: question changes refetch the event, reactions
  // float up on the screen, and another event going live on the stage
  // switches the screen to it.
  const onEventLiveRef = useRef(onEventLive);
  onEventLiveRef.current = onEventLive;
  const events = useMemo(() => ({
    reaction: (data: string) => addReaction(JSON.parse(data) as Reaction),
    live: (data: string) => {
      const { uid } = JSON.parse(data) as { uid: string };
      onEventLiveRef.current?.(uid);
    },
  }), [addReaction]);
  useEventSource({
    url: event ? apiUrl(`/api/v1/events/${event.uid}/questions/stream`) : undefined,
    onMessage: onQuestionsChanged,
    events,
  });

  const allQuestions = event?.questions ?? [];
  const shownQuestions = topQuestions(allQuestions);
  const moreCount = allQuestions.length - shownQuestions.length;

  return (
    <div className={`page ${hideQRCode ? "hide-qr-code" : ""}`}>
      <header>
        <div className="title">
          <Heading as="h1" size="3xl">
            {event?.title}
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
