import { useMeerkatContext } from "./context.ts";

export function useSessionUrl(sessionId: string): string {
  const { apiUrl } = useMeerkatContext();
  return `${apiUrl}/e/${sessionId}/qa`;
}
