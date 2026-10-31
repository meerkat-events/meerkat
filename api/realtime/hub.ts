import logger from "../logger.ts";
import type { Bus, RealtimeMessage } from "./bus.ts";

export type HubListener = (message: RealtimeMessage) => void;

type StreamEvent = { id: number; conferenceId: number; stage: string };

export type Hub = {
  /**
   * What an event's stream needs: its questions, votes and reactions, and
   * events put live on its stage within its conference (stage names repeat
   * across conferences). Returns the unsubscribe.
   */
  listenToEventStream(event: StreamEvent, listener: HubListener): () => void;
  /** Questions and votes of every event of a conference, no reactions. */
  listenToConference(conferenceId: number, listener: HubListener): () => void;
  /** Subscribes to the bus now instead of on the first listener. */
  start(): void;
  /** Number of local listeners, for tests. */
  listenerCount(): number;
};

const eventKey = (eventId: number) => `event:${eventId}`;
const conferenceKey = (conferenceId: number) => `conference:${conferenceId}`;
const stageKey = (conferenceId: number, stage: string) =>
  `stage:${conferenceId}:${stage}`;

/**
 * Fans the bus's messages out to this process's SSE streams. It holds one
 * bus subscription for the whole process, made on the first listener.
 */
export function createHub(bus: Bus): Hub {
  const listenersByKey = new Map<string, Set<HubListener>>();
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
        callAll(eventKey(message.eventId), message);
        callAll(conferenceKey(message.conferenceId), message);
        break;
      case "reaction":
        callAll(eventKey(message.eventId), message);
        break;
      case "live":
        callAll(stageKey(message.conferenceId, message.stage), message);
        break;
      case "resync":
        // An event stream listens under two keys but resyncs once.
        for (const listener of distinctListeners()) {
          call(listener, message);
        }
        break;
    }
  }

  function callAll(key: string, message: RealtimeMessage) {
    for (const listener of listenersByKey.get(key) ?? []) {
      call(listener, message);
    }
  }

  // One failing listener must not keep the message from the others.
  function call(listener: HubListener, message: RealtimeMessage) {
    try {
      listener(message);
    } catch (err) {
      logger.error({ err, type: message.type }, "Realtime listener failed");
    }
  }

  function distinctListeners() {
    const all = new Set<HubListener>();
    for (const listeners of listenersByKey.values()) {
      for (const listener of listeners) {
        all.add(listener);
      }
    }
    return all;
  }

  function addListener(key: string, listener: HubListener) {
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

  function listenToEventStream(event: StreamEvent, listener: HubListener) {
    const stopEvent = addListener(eventKey(event.id), listener);
    const stopStage = addListener(
      stageKey(event.conferenceId, event.stage),
      listener,
    );
    return () => {
      stopEvent();
      stopStage();
    };
  }

  return {
    listenToEventStream,
    listenToConference: (conferenceId, listener) =>
      addListener(conferenceKey(conferenceId), listener),
    start,
    listenerCount: () => distinctListeners().size,
  };
}
