import { useState } from "react";

/**
 * Whether `open` has been true at least once. A lazily loaded overlay mounts
 * when it first opens and stays mounted afterwards, so it can animate closed
 * and open again without another load.
 */
export function useHasOpened(open: boolean) {
  const [hasOpened, setHasOpened] = useState(open);
  if (open && !hasOpened) {
    setHasOpened(true);
  }
  return hasOpened;
}
