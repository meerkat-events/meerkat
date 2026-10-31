/**
 * The bus carries realtime messages between server instances: a mutation on
 * one Fly machine tells the SSE clients connected to every other machine.
 * Messages carry ids and the public fields of a reaction only, never question
 * text or user ids; clients refetch through the API, which decides what each
 * viewer may see.
 *
 * `postgres-bus.ts` implements it with LISTEN/NOTIFY, `memory-bus.ts` within
 * one process (tests). Another transport (Redis pub/sub) is one more file
 * implementing `Bus`, chosen in `index.ts`.
 */

/** The public fields of a reaction, as the react route answers them. */
export type PublicReaction = {
  uid: string;
  emoji: string;
  createdAt: string;
};

/** A message one instance publishes to all instances, itself included. */
export type PublishedMessage =
  | { type: "questions"; eventId: number; conferenceId: number }
  | { type: "reaction"; eventId: number; reaction: PublicReaction }
  // An event was put live; the stage's screens switch to it.
  | { type: "live"; eventId: number; eventUid: string; stage: string };

/**
 * What subscribers receive: published messages, plus `resync` when the bus
 * may have missed messages (after a reconnect), so every list refetches.
 */
export type RealtimeMessage = PublishedMessage | { type: "resync" };

export type MessageHandler = (message: RealtimeMessage) => void;

export interface Bus {
  publish(message: PublishedMessage): Promise<void>;
  /** Returns the unsubscribe function. */
  subscribe(handler: MessageHandler): () => void;
}

/**
 * Parses a message received over the wire, or returns undefined for anything
 * that isn't one (a different version's message type, a malformed payload).
 */
export function parsePublishedMessage(
  payload: string,
): PublishedMessage | undefined {
  let message: unknown;
  try {
    message = JSON.parse(payload);
  } catch {
    return undefined;
  }
  if (typeof message !== "object" || message === null) {
    return undefined;
  }
  const { type, eventId } = message as { type?: unknown; eventId?: unknown };
  if (typeof eventId !== "number") {
    return undefined;
  }
  if (type === "questions" || type === "reaction" || type === "live") {
    return message as PublishedMessage;
  }
  return undefined;
}
