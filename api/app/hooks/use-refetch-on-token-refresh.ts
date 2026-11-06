import { useEffect, useRef } from "react";

/**
 * Refetches, keeping the current data on screen, when the session's access
 * token is replaced by a refreshed one.
 *
 * SWR keys carry the user id, not the token, so a refresh doesn't empty the
 * page. But a request can go out with the expired token just before the
 * refresh, typically when a phone wakes up and SWR revalidates on focus:
 * protected routes answer 401, and the question list answers as for a guest
 * (no votes, no own hidden questions). This refetch, with the new token,
 * corrects either. Signing in or out changes the key and needs no help here.
 */
export function useRefetchOnTokenRefresh(
  token: string | undefined,
  refetch: () => unknown,
) {
  const previousToken = useRef(token);

  useEffect(() => {
    const isRefresh = previousToken.current !== undefined &&
      token !== undefined &&
      previousToken.current !== token;
    previousToken.current = token;
    if (isRefresh) {
      refetch();
    }
  }, [token, refetch]);
}
