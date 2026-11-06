import { useState } from "react";
import { useSWRConfig } from "swr";
import { Icon, IconButton } from "@chakra-ui/react";
import { LuRefreshCw } from "react-icons/lu";

/** Refetches everything on the management page, with a spinner until done. */
export function RefreshButton() {
  const { cache, mutate } = useSWRConfig();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
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
      title="Refresh"
      // Shows a spinner and disables the button while refreshing.
      loading={refreshing}
      onClick={refresh}
    >
      <Icon as={LuRefreshCw} />
    </IconButton>
  );
}
