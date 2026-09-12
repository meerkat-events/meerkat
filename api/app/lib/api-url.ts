// Origin the browser uses for API calls and absolute app links.
//
// `VITE_API_URL` is baked into the bundle at build time. When it is unset or
// empty (the default for local development and Docker), the frontend talks to
// the same origin it was served from: fetches use relative paths and absolute
// links are built from `location.origin`. One build therefore works on any
// port, which is what lets several worktrees run their own dev server.
export const API_BASE: string = import.meta.env["VITE_API_URL"] ?? "";

export function apiUrl(endpoint: string): string {
  return `${API_BASE}${endpoint}`;
}

// Absolute origin for links that leave the page (QR codes, share URLs).
// Browser-only: relies on `location` when no explicit API origin is set.
export function appOrigin(): string {
  return API_BASE || globalThis.location.origin;
}
