import { useCallback, useEffect, useState } from "react";
import { BADGES, type PodiumBadge } from "../components/Leaderboard/podium.ts";

export type PodiumChange = {
  /** Onto the podium or up a place, down a place, or off the podium. */
  kind: "up" | "down" | "lost";
  from: PodiumBadge | undefined;
  to: PodiumBadge | undefined;
};

// How long the change animation and its label stay up
const CHANGE_DURATION_MS = 3200;

const storageKey = (conferenceId: number, userId: string) =>
  `meerkat:podium-rank:${conferenceId}:${userId}`;

// 0 means "not on the podium"
const readRank = (key: string) => {
  try {
    return Number(globalThis.localStorage?.getItem(key) ?? 0) || 0;
  } catch {
    return 0;
  }
};

const writeRank = (key: string, rank: number) => {
  try {
    globalThis.localStorage?.setItem(key, String(rank));
  } catch {
    // Blocked storage: the change animates again next visit, which is fine.
  }
};

export type UsePodiumChangeOptions = {
  conferenceId: number | undefined;
  userId: string | undefined;
  /** The user's podium badge; only meaningful once `isLoaded`. */
  badge: PodiumBadge | undefined;
  isLoaded: boolean;
};

/**
 * Compares the user's podium place with the last one this browser saw for
 * the conference, and reports the change so the page can animate it. Moving
 * down or off the podium clears itself after a few seconds; moving up stays
 * until `dismiss` (its celebration waits to be closed). Changes that happened
 * while away show on the next visit.
 */
export function usePodiumChange(
  { conferenceId, userId, badge, isLoaded }:
    UsePodiumChangeOptions,
) {
  const [change, setChange] = useState<PodiumChange>();
  const rank = badge?.rank ?? 0;

  useEffect(() => {
    if (!isLoaded || conferenceId === undefined || !userId) return;
    const key = storageKey(conferenceId, userId);
    const previous = readRank(key);
    writeRank(key, rank);
    if (previous === rank) return;

    const kind = rank === 0
      ? "lost"
      : previous === 0 || rank < previous
      ? "up"
      : "down";
    // Deferred so the state change happens outside the effect body
    const show = setTimeout(
      () => setChange({ kind, from: BADGES[previous], to: badge }),
      0,
    );
    const hide = kind === "up"
      ? undefined
      : setTimeout(() => setChange(undefined), CHANGE_DURATION_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [isLoaded, conferenceId, userId, rank, badge]);

  const dismiss = useCallback(() => setChange(undefined), []);

  return { change, dismiss };
}
