import { useCallback, useEffect, useState } from "react";
import { isBetterTier, TIERS } from "../components/Points/tier.ts";
import type { Tier } from "../types.ts";

export type TierPromotion = {
  /** The tier they had before, or null when they had none. */
  from: Tier | null;
  to: Tier;
};

const storageKey = (conferenceId: number, userId: string) =>
  `meerkat:tier:${conferenceId}:${userId}`;

// Anything that isn't a known tier reads as "no tier"
const readTier = (key: string): Tier | null => {
  try {
    const stored = Number(globalThis.localStorage?.getItem(key));
    return TIERS.find((tier) => tier === stored) ?? null;
  } catch {
    return null;
  }
};

const writeTier = (key: string, tier: Tier | null) => {
  try {
    globalThis.localStorage?.setItem(key, tier === null ? "" : String(tier));
  } catch {
    // Blocked storage: the promotion is celebrated again next visit, which is
    // fine.
  }
};

export type UseTierPromotionOptions = {
  conferenceId: number | undefined;
  userId: string | undefined;
  /** The user's tier; only meaningful once `isLoaded`. */
  tier: Tier | null;
  isLoaded: boolean;
};

/**
 * Compares the user's tier with the last one this browser saw for the
 * conference and reports a move into a better tier, until `dismiss`. Moving
 * down is only remembered, so climbing back up is celebrated again. Changes
 * that happened while away show on the next visit.
 */
export function useTierPromotion(
  { conferenceId, userId, tier, isLoaded }: UseTierPromotionOptions,
) {
  const [promotion, setPromotion] = useState<TierPromotion>();

  useEffect(() => {
    if (!isLoaded || conferenceId === undefined || !userId) return;
    const key = storageKey(conferenceId, userId);
    const previous = readTier(key);
    writeTier(key, tier);
    if (tier === null || !isBetterTier(tier, previous)) return;

    // Deferred so the state change happens outside the effect body
    const show = setTimeout(() => setPromotion({ from: previous, to: tier }), 0);
    return () => clearTimeout(show);
  }, [isLoaded, conferenceId, userId, tier]);

  const dismiss = useCallback(() => setPromotion(undefined), []);

  return { promotion, dismiss };
}
