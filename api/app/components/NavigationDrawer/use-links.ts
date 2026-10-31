import { useMemo } from "react";
import { useLocation } from "react-router";
import { qa } from "../../routing.ts";
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
    ],
    [event?.uid, location.pathname],
  );
}
