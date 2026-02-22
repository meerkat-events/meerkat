import React, { useMemo } from "react";
import { SWRConfig } from "swr";
import { MeerkatContext } from "./context.ts";
import { createFetcher } from "./fetcher.ts";

const DEFAULT_API_URL = "https://app.meerkat.events";

export interface MeerkatProviderProps {
  /**
   * Meerkat API url.
   * @default "https://app.meerkat.events"
   */
  apiUrl?: string | undefined;
  children: React.ReactNode;
}

export function MeerkatProvider({
  apiUrl = DEFAULT_API_URL,
  children,
}: MeerkatProviderProps) {
  const contextValue = useMemo(() => ({ apiUrl }), [apiUrl]);
  const fetcher = useMemo(() => createFetcher(apiUrl), [apiUrl]);

  return (
    <MeerkatContext.Provider value={contextValue}>
      <SWRConfig value={{ fetcher }}>{children}</SWRConfig>
    </MeerkatContext.Provider>
  );
}
