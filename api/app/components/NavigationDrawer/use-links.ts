import { useMemo } from "react";
import { useLocation } from "react-router";
import { card, qa } from "../../routing.ts";
import type { Event } from "../../types.ts";

export type UseLinksProps = {
  event?: Event | undefined;
};

export function useLinks({ event }: UseLinksProps) {
  const location = useLocation();

  return useMemo(
    () => [
      {
        label: "Q&A",
        href: qa(event?.uid ?? ""),
        active: location.pathname.endsWith("/qa"),
      },
      ...(event?.conference.features["collect"]
        ? [{
          label: "Collect",
          href: card(event?.uid ?? ""),
          active: location.pathname.endsWith("/card"),
        }]
        : []),
    ],
    [event?.uid, location.pathname],
  );
}
