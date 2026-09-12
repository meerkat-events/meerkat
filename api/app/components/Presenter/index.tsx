import QR from "../QR.tsx";
import { Heading, Text } from "@chakra-ui/react";
import TopQuestions from "../TopQuestions.tsx";
import { useReactionsSubscription } from "../../hooks/use-reactions-subscription.ts";
import { HeartIcon } from "../assets/heart.ts";
import { useSearchParams } from "react-router";
import { useCallback, useState } from "react";
import type { Event, Reaction } from "../../types.ts";
import { REACTION_GLYPHS, type ReactionEmoji } from "../../../reactions.ts";
import { randomNormal } from "d3-random";

import "./styles.css";

const randomX = randomNormal(50, 8);

export type PresenterProps = {
  event: Event | undefined;
  url: URL | undefined;
};

export default function Presenter({ event, url }: PresenterProps) {
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

  useReactionsSubscription(event, {
    onUpdate: addReaction,
  });

  return (
    <div className={`page ${hideQRCode ? "hide-qr-code" : ""}`}>
      <header>
        <div className="title">
          <Heading as="h1" size="3xl">
            {event?.title}
          </Heading>
          <Text fontSize="xl">
            {event?.speaker}
          </Text>
        </div>
        <div className="logo">
          <Text className="font-family-meerkat" fontSize="sm" fontWeight="bold">
            meerkat.events
          </Text>
        </div>
      </header>
      <main>
        <TopQuestions questions={event?.questions ?? []} />
      </main>
      <aside>
        {!hideQRCode && url && <QR url={url} />}
        <Text fontSize="xl" fontWeight="bold" textAlign="center">
          Participants {event?.participants}
        </Text>
      </aside>

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
