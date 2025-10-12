import QR from "~/components/QR";
import { Heading, Text } from "@chakra-ui/react";
import TopQuestions from "~/components/TopQuestions";
import { useReactionsSubscription } from "~/hooks/use-reactions-subscription";
import { HeartIcon } from "~/components/assets/heart";
import { useSearchParams } from "react-router";
import { useCallback, useState } from "react";
import type { Event } from "~/types";
import { randomNormal } from "d3-random";

import "./styles.css";

const randomX = randomNormal(50, 8);

export type PresenterProps = {
  event: Event & { url: URL } | undefined;
};

export default function Presenter({ event }: PresenterProps) {
  const [searchParams] = useSearchParams();
  const [reactions, setReactions] = useState<{ id: string; x: number }[]>([]);

  const hideQRCode = searchParams.get("hide-qr-code") === "true";

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
