import { useCallback, useEffect, useState } from "react";
import { isBetterTier, TIERS } from "../components/Points/tier.ts";
import { readStorage, writeStorage } from "../lib/storage.ts";
import type { Tier } from "../types.ts";

export type TierPromotion = {
  /** The tier they had before, or null when they had none. */
  from: Tier | null;
  to: Tier;
};

const storageKey = (conferenceId: number, userId: string) =>
  `meerkat:tier:${conferenceId}:${userId}`;

// The best tier this browser has seen the user reach in the conference.
// Anything that isn't a known tier reads as "no tier".
const readBestTier = (key: string): Tier | null => {
  const stored = Number(readStorage(key));
  return TIERS.find((tier) => tier === stored) ?? null;
};

// Blocked storage: the promotion is celebrated again next visit, which is
// fine.
const writeBestTier = (key: string, tier: Tier) =>
  writeStorage(key, String(tier));

export type UseTierPromotionOptions = {
  conferenceId: number | undefined;
  userId: string | undefined;
  /** The user's tier; only meaningful once `isLoaded`. */
  tier: Tier | null;
  isLoaded: boolean;
};

/**
 * Compares the user's tier with the best one this browser has seen them reach
 * in the conference and reports a move beyond it, until `dismiss`. Each tier
 * is celebrated once: someone on the edge of a tier drops out and climbs back
 * whenever others overtake them, and celebrating every return would get
 * annoying. Changes that happened while away show on the next visit.
 */
export function useTierPromotion(
  { conferenceId, userId, tier, isLoaded }: UseTierPromotionOptions,
) {
  const [promotion, setPromotion] = useState<TierPromotion>();

  useEffect(() => {
    if (!isLoaded || conferenceId === undefined || !userId) return;
    const key = storageKey(conferenceId, userId);
    const previous = readBestTier(key);
    if (tier === null || !isBetterTier(tier, previous)) return;

    // Deferred so the state change happens outside the effect body. The tier
    // is stored once it shows, so a cancelled celebration comes back.
    const show = setTimeout(() => {
      writeBestTier(key, tier);
      setPromotion({ from: previous, to: tier });
    }, 0);
    return () => clearTimeout(show);
  }, [isLoaded, conferenceId, userId, tier]);

  const dismiss = useCallback(() => setPromotion(undefined), []);

  return { promotion, dismiss };
}
