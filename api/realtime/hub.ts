import logger from "../logger.ts";
import type { Bus, RealtimeMessage } from "./bus.ts";

export type HubListener = (message: RealtimeMessage) => void;

export type Hub = {
  /** Questions, votes and reactions of one event. Returns the unsubscribe. */
  listenToEvent(eventId: number, listener: HubListener): () => void;
  /** Questions and votes of every event of a conference, no reactions. */
  listenToConference(conferenceId: number, listener: HubListener): () => void;
  /** Events put live on a stage (stage names are global, like signage). */
  listenToStage(stage: string, listener: HubListener): () => void;
  /** Subscribes to the bus now instead of on the first listener. */
  start(): void;
  /** Number of local listeners, for tests. */
  listenerCount(): number;
};

/**
 * Fans the bus's messages out to this process's SSE streams. It holds one
 * bus subscription for the whole process, made on the first listener.
 */
export function createHub(bus: Bus): Hub {
  const eventListeners = new Map<number, Set<HubListener>>();
  const conferenceListeners = new Map<number, Set<HubListener>>();
  const stageListeners = new Map<string, Set<HubListener>>();
  let isSubscribed = false;

  function start() {
    if (isSubscribed) {
      return;
    }
    isSubscribed = true;
    bus.subscribe(dispatch);
  }

  function dispatch(message: RealtimeMessage) {
    switch (message.type) {
      case "questions":
        callAll(eventListeners.get(message.eventId), message);
        callAll(conferenceListeners.get(message.conferenceId), message);
        break;
      case "reaction":
        callAll(eventListeners.get(message.eventId), message);
        break;
      case "live":
        callAll(stageListeners.get(message.stage), message);
        break;
      // Stage listeners miss nothing worth refetching: signage also polls.
      case "resync":
        for (const listeners of eventListeners.values()) {
          callAll(listeners, message);
        }
        for (const listeners of conferenceListeners.values()) {
          callAll(listeners, message);
        }
        break;
    }
  }

  // One failing listener must not keep the message from the others.
  function callAll(
    listeners: Set<HubListener> | undefined,
    message: RealtimeMessage,
  ) {
    for (const listener of listeners ?? []) {
      try {
        listener(message);
      } catch (err) {
        logger.error({ err, type: message.type }, "Realtime listener failed");
      }
    }
  }

  function addListener<Key>(
    listenersByKey: Map<Key, Set<HubListener>>,
    key: Key,
    listener: HubListener,
  ) {
    start();
    let listeners = listenersByKey.get(key);
    if (!listeners) {
      listeners = new Set();
      listenersByKey.set(key, listeners);
    }
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && listenersByKey.get(key) === listeners) {
        listenersByKey.delete(key);
      }
    };
  }

  function listenerCount() {
    let count = 0;
    for (const listenersByKey of [
      eventListeners,
      conferenceListeners,
      stageListeners,
    ]) {
      for (const listeners of listenersByKey.values()) {
        count += listeners.size;
      }
    }
    return count;
  }

  return {
    listenToEvent: (eventId, listener) =>
      addListener(eventListeners, eventId, listener),
    listenToConference: (conferenceId, listener) =>
      addListener(conferenceListeners, conferenceId, listener),
    listenToStage: (stage, listener) =>
      addListener(stageListeners, stage, listener),
    start,
    listenerCount,
  };
}
