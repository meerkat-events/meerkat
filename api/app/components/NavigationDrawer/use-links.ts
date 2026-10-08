import { useMemo } from "react";
import { useLocation } from "react-router";
import { card, leaderboard, qa } from "../../routing.ts";
import type { Event } from "../../types.ts";

export type UseLinksProps = {
  event?: Event | undefined;
};

export function useLinks({ event }: UseLinksProps) {
  const location = useLocation();

  return useMemo(
    () => [
      {
        label: "Questions",
        href: qa(event?.uid ?? ""),
        active: location.pathname.endsWith("/qa"),
      },
      ...(event?.conference.features["collect"]
        ? [{
          label: "Event Card",
          href: card(event?.uid ?? ""),
          active: location.pathname.endsWith("/card"),
        }]
        : []),
      {
        label: "Leaderboard",
        href: leaderboard(event?.uid ?? ""),
        active: location.pathname.endsWith("/leaderboard"),
      },
    ],
    [event?.uid, event?.conference.features, location.pathname],
  );
}
