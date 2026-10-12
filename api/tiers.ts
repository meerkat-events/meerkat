/**
 * Percentile tiers, best first: "top 10" means at most 10% of a conference's
 * contributors (everyone who asked or voted) are at or above a place.
 */
export const TIERS = [0.1, 1, 10, 25] as const;

export type Tier = (typeof TIERS)[number];

/**
 * Below this many contributors nobody gets a tier: being "top 25%" of a
 * handful of people says little.
 */
export const MIN_CONTRIBUTORS = 20;

/**
 * The best tier for a place among `contributors` people, or null below the
 * last one or with too few contributors. Ties share the better place, so
 * `place` is one more than the number of people with strictly more points.
 */
export function tierFor(place: number, contributors: number): Tier | null {
  if (contributors < MIN_CONTRIBUTORS) return null;
  for (const tier of TIERS) {
    if (place <= (tier / 100) * contributors) return tier;
  }
  return null;
}
