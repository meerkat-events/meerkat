/**
 * The stage screen is the presenter view (`/e/:uid`) in keep-live mode: it
 * follows the stage from one event to the next. Its options live in the
 * query string (e.g. `hide-qr-code=true`), so every move to another event
 * has to carry them along. Used by the `/stage/:stage` redirect and by the
 * presenter view itself; DB-free, so the client can import it.
 */
export function stageScreenSearchParams(current: URLSearchParams) {
  const searchParams = new URLSearchParams(current);
  searchParams.set("keep-live", "true");
  return searchParams;
}
