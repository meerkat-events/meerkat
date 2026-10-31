import { sql } from "drizzle-orm";
import postgres from "postgres";
import db from "../db.ts";
import logger from "../logger.ts";
import {
  type Bus,
  type MessageHandler,
  type PublishedMessage,
  type RealtimeMessage,
  toPublishedMessage,
} from "./bus.ts";

const CHANNEL = "meerkat_realtime";

// How often the bus checks that it receives its own NOTIFY, and how long it
// waits for it. A missing one means the LISTEN connection is gone (or never
// worked), so the listener is replaced.
const FIRST_CHECK_DELAY_MS = 5_000;
const CHECK_INTERVAL_MS = 60_000;
const CHECK_TIMEOUT_MS = 10_000;

type DeliveryCheck = { type: "check"; id: string };

/**
 * The bus over Postgres LISTEN/NOTIFY. Publishing uses `pg_notify` through the
 * app's pool, which works through a transaction pooler. Listening needs a
 * session, so it gets its own connection on `listenConnectionString` (direct
 * or session pooler), opened on the first `subscribe`, not at import.
 */
export function createPostgresBus(listenConnectionString: string): Bus {
  const handlers = new Set<MessageHandler>();
  let listener: postgres.Sql | undefined;
  let hasConnected = false;
  // The delivery check in flight; its timeout is set once the NOTIFY is sent.
  let pendingCheck:
    | { id: string; timeout: NodeJS.Timeout | undefined }
    | undefined;

  function deliver(message: RealtimeMessage) {
    for (const handler of handlers) {
      handler(message);
    }
  }

  function onNotify(payload: string) {
    let value: unknown;
    try {
      value = JSON.parse(payload);
    } catch {
      return;
    }
    if (isDeliveryCheck(value)) {
      if (pendingCheck?.id === value.id) {
        clearTimeout(pendingCheck.timeout);
        pendingCheck = undefined;
      }
      return;
    }
    const message = toPublishedMessage(value);
    if (message) {
      deliver(message);
    }
  }

  // Called on the first LISTEN and again after every reconnect. Messages sent
  // while the connection was down are lost, so subscribers resync.
  function onListen() {
    if (hasConnected) {
      logger.info("Realtime listener reconnected, resyncing");
      deliver({ type: "resync" });
    } else {
      hasConnected = true;
      logger.info("Realtime listener connected");
    }
  }

  function connect() {
    listener = postgres(listenConnectionString, {
      prepare: false,
      connect_timeout: 30,
      onnotice: () => {},
    });
    listener.listen(CHANNEL, onNotify, onListen).catch((err) => {
      logger.error({ err }, "Realtime LISTEN failed");
    });
  }

  async function reconnect() {
    const previous = listener;
    connect();
    await previous?.end({ timeout: 1 }).catch(() => {});
  }

  // Only a NOTIFY that was sent and never arrived says the listener is dead.
  // A slow or failing publish says nothing about it (the app's pool may just
  // be busy), so the timeout starts once the NOTIFY is sent, and a failed
  // publish skips this check instead of reconnecting: a needless reconnect
  // makes every client of the instance refetch at once.
  async function checkDelivery() {
    if (pendingCheck) {
      return;
    }
    const id = globalThis.crypto.randomUUID();
    // Set before sending: the NOTIFY can arrive before notify() resolves.
    pendingCheck = { id, timeout: undefined };
    try {
      await notify({ type: "check", id });
    } catch (err) {
      logger.error({ err }, "Realtime delivery check failed to publish");
      pendingCheck = undefined;
      return;
    }
    if (pendingCheck?.id !== id) {
      return; // Already arrived.
    }
    pendingCheck.timeout = setTimeout(() => {
      pendingCheck = undefined;
      logger.error(
        "Realtime listener missed its own NOTIFY, reconnecting. DATABASE_URL " +
          "must be a direct or session pooler connection.",
      );
      void reconnect();
    }, CHECK_TIMEOUT_MS);
  }

  function start() {
    connect();
    setTimeout(() => void checkDelivery(), FIRST_CHECK_DELAY_MS).unref();
    setInterval(() => void checkDelivery(), CHECK_INTERVAL_MS).unref();
  }

  return {
    async publish(message: PublishedMessage) {
      await notify(message);
    },
    subscribe(handler: MessageHandler) {
      if (!listener) {
        start();
      }
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
  };
}

async function notify(message: PublishedMessage | DeliveryCheck) {
  await db.execute(
    sql`SELECT pg_notify(${CHANNEL}, ${JSON.stringify(message)})`,
  );
}

function isDeliveryCheck(value: unknown): value is DeliveryCheck {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const message = value as Record<string, unknown>;
  return message["type"] === "check" && typeof message["id"] === "string";
}
