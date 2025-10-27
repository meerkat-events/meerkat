import { useMemo } from "react";
import { useLocation } from "react-router";
import { card, feedback, qa } from "~/routing";
import type { Event } from "~/types";

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
      {
        label: "Collect",
        href: card(event?.uid ?? ""),
        active: location.pathname.endsWith("/card"),
      },
      {
        label: "Feedback",
        href: feedback(event?.uid ?? ""),
        active: location.pathname.endsWith("/feedback"),
      },
    ],
    [event?.uid, location.pathname],
  );
}
