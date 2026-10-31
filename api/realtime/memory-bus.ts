import type {
  Bus,
  MessageHandler,
  PublishedMessage,
  RealtimeMessage,
} from "./bus.ts";

/** A bus within one process, for tests. */
export function createMemoryBus(): Bus & { resync(): void } {
  const handlers = new Set<MessageHandler>();

  function deliver(message: RealtimeMessage) {
    for (const handler of handlers) {
      handler(structuredClone(message));
    }
  }

  return {
    publish(message: PublishedMessage) {
      deliver(message);
      return Promise.resolve();
    },
    subscribe(handler: MessageHandler) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
    /** Delivers `resync`, as the Postgres bus does after reconnecting. */
    resync() {
      deliver({ type: "resync" });
    },
  };
}
