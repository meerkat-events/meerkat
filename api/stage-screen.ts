/**
 * The presenter view (`/e/:uid`) in keep-live mode, the older form of the
 * stage screen (`/stage/:stage` now switches events in place): it follows
 * the stage from one event to the next. Its options live in the query string
 * (e.g. `hide-qr-code=true`), so every move to another event has to carry
 * them along. DB-free, so the client can import it.
 */
export function stageScreenSearchParams(current: URLSearchParams) {
  const searchParams = new URLSearchParams(current);
  searchParams.set("keep-live", "true");
  return searchParams;
}
