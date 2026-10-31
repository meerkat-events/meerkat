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
  // `isPublic` is false for a question moderation hid on arrival: only the
  // organizer streams hear about it.
  | {
    type: "questions";
    eventId: number;
    conferenceId: number;
    isPublic: boolean;
  }
  | { type: "reaction"; eventId: number; reaction: PublicReaction }
  // An event was put live; the screens and Q&A pages of its stage, within
  // its conference, switch to it or offer it.
  | {
    type: "live";
    eventId: number;
    eventUid: string;
    title: string;
    conferenceId: number;
    stage: string;
  };

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
 * Checks a decoded wire message, or returns undefined for anything that isn't
 * a complete one (another version's message, a malformed payload), so a
 * stream never sends half a message.
 */
export function toPublishedMessage(
  value: unknown,
): PublishedMessage | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const message = value as Record<string, unknown>;
  if (typeof message["eventId"] !== "number") {
    return undefined;
  }

  switch (message["type"]) {
    case "questions":
      return typeof message["conferenceId"] === "number" &&
          typeof message["isPublic"] === "boolean"
        ? value as PublishedMessage
        : undefined;
    case "reaction":
      return isPublicReaction(message["reaction"])
        ? value as PublishedMessage
        : undefined;
    case "live":
      return typeof message["eventUid"] === "string" &&
          typeof message["title"] === "string" &&
          typeof message["conferenceId"] === "number" &&
          typeof message["stage"] === "string"
        ? value as PublishedMessage
        : undefined;
    default:
      return undefined;
  }
}

function isPublicReaction(value: unknown): value is PublicReaction {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const reaction = value as Record<string, unknown>;
  return typeof reaction["uid"] === "string" &&
    typeof reaction["emoji"] === "string" &&
    typeof reaction["createdAt"] === "string";
}
