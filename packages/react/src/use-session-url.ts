import { useMemo } from "react";
import { useMeerkatContext } from "./context.ts";

export function useSessionUrl(sessionId: string): string {
  const { apiUrl } = useMeerkatContext();
  return useMemo(
    () => `${apiUrl}/e/${sessionId}/qa`,
    [apiUrl, sessionId],
  );
}
