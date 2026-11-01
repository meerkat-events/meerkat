import type { Questions, Sort } from "./models/questions.ts";
import type { Bus, RealtimeMessage } from "./realtime/bus.ts";

/**
 * How long one guest question list answers every request for it. A change
 * drops it at once (the bus), so this only bounds staleness the bus can't
 * see (a ban running out) or while it is down. Short, but each change's
 * refetches arrive within 500 ms (`useJitteredRefresh`), so a few loads still
 * serve the whole burst on this instance.
 */
export const QUESTION_LIST_TTL_MS = 200;

/**
 * At most this many lists (an event and a sort each) are kept. Past it, the
 * oldest is dropped: it is the closest to expiring anyway.
 */
export const MAX_QUESTION_LISTS = 200;

export type QuestionListCache = {
  /** The event's questions as guests see them, `getQuestions` without a viewer. */
  get(eventId: number, sort: Sort): Promise<Questions>;
  /**
   * Drops the event's lists now, as a `questions` message does when it
   * arrives. The instance that made a change calls it before publishing, so
   * the author's own refetch can't beat the message back to it.
   */
  forget(eventId: number): void;
};

type Entry = { questions: Promise<Questions> };

/**
 * Shares one load of an event's guest question list between the requests of
 * this instance: requests arriving while it loads wait for the same load, and
 * later ones reuse it until the bus says the event's questions changed, or
 * until `ttlMs` after the load started. A list that started loading before a
 * change is never handed out after it.
 */
export function createQuestionListCache(
  {
    bus,
    load,
    ttlMs = QUESTION_LIST_TTL_MS,
    maxEntries = MAX_QUESTION_LISTS,
  }: {
    bus: Bus;
    load: (eventId: number, sort: Sort) => Promise<Questions>;
    ttlMs?: number;
    maxEntries?: number;
  },
): QuestionListCache {
  const entries = new Map<string, Entry>();
  let isSubscribed = false;

  function key(eventId: number, sort: Sort) {
    return `${eventId}:${sort}`;
  }

  function forgetEvent(eventId: number) {
    entries.delete(key(eventId, "popular"));
    entries.delete(key(eventId, "newest"));
  }

  function onMessage(message: RealtimeMessage) {
    if (message.type === "questions") {
      forgetEvent(message.eventId);
    } else if (message.type === "resync") {
      // Messages may have been missed, so any list may be outdated.
      entries.clear();
    }
  }

  function dropEntry(entryKey: string, entry: Entry) {
    if (entries.get(entryKey) === entry) {
      entries.delete(entryKey);
    }
  }

  function get(eventId: number, sort: Sort) {
    // On first use, like the hub: subscribing opens the bus's connection.
    if (!isSubscribed) {
      isSubscribed = true;
      bus.subscribe(onMessage);
    }

    const entryKey = key(eventId, sort);
    const cached = entries.get(entryKey);
    if (cached) {
      return cached.questions;
    }

    const entry: Entry = { questions: load(eventId, sort) };
    entries.set(entryKey, entry);
    if (entries.size > maxEntries) {
      // A Map iterates in insertion order, so the first key is the oldest.
      const oldestKey = entries.keys().next().value;
      if (oldestKey !== undefined) {
        entries.delete(oldestKey);
      }
    }
    setTimeout(() => dropEntry(entryKey, entry), ttlMs).unref();
    // A failed load isn't kept: the next request tries again.
    entry.questions.catch(() => dropEntry(entryKey, entry));
    return entry.questions;
  }

  return { get, forget: forgetEvent };
}
