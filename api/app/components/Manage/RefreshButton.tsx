import { useEffect, useState } from "react";
import { useSWRConfig } from "swr";
import { Icon, IconButton } from "@chakra-ui/react";
import { LuRefreshCw } from "react-icons/lu";
import { useIsFetching } from "../../hooks/fetch-activity.ts";

// A poll can finish in a few milliseconds; keep spinning a little longer so
// the icon visibly turns instead of twitching.
const MIN_SPIN_MS = 600;

/**
 * Refetches everything on the management page, and spins while anything on
 * it is being fetched, including the pages' own polls and live updates.
 */
export function RefreshButton() {
  const { cache, mutate } = useSWRConfig();
  const spinning = useStaysOnFor(useIsFetching(), MIN_SPIN_MS);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    // One refresh at a time: another click would restart every request.
    if (refreshing) return;
    setRefreshing(true);
    try {
      // A filter skips infinite lists (the attendees on Permissions), so
      // they are revalidated by their keys, which SWR prefixes with $inf$.
      const infiniteKeys = [...cache.keys()].filter((key) => key.startsWith("$inf$"));
      await Promise.all([
        mutate(() => true),
        ...infiniteKeys.map((key) => mutate(key)),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <IconButton
      size="sm"
      variant="ghost"
      colorPalette="gray"
      color="fg.muted"
      aria-label="Refresh"
      aria-busy={spinning}
      title={spinning ? "Refreshing…" : "Refresh"}
      className="m-refresh"
      onClick={refresh}
    >
      <Icon as={LuRefreshCw} />
    </IconButton>
  );
}

/** `active`, but staying true for `ms` after it turns false. */
function useStaysOnFor(active: boolean, ms: number) {
  const [wasActive, setWasActive] = useState(active);
  // Counts the times `active` turned false; each one restarts the timer.
  const [stops, setStops] = useState(0);
  const [lingering, setLingering] = useState(false);
  if (active !== wasActive) {
    setWasActive(active);
    if (!active) {
      setStops(stops + 1);
      setLingering(true);
    }
  }
  useEffect(() => {
    const timer = setTimeout(() => setLingering(false), ms);
    return () => clearTimeout(timer);
  }, [stops, ms]);
  return active || lingering;
}
