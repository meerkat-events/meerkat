/**
 * The routes some tests check by kind, as "METHOD /path" the way Hono
 * registers them (`app.routes`). Test-only: nothing at runtime imports this.
 * `app.test.ts` fails when a route is added without classifying it here, so
 * a new route's authorization and real-time behavior are decided on purpose.
 */

/**
 * What a public route returns. `json` routes are checked for what they leak
 * (integration/public-responses.int.ts); the others carry no data of ours.
 */
export type PublicRouteKind = "json" | "stream" | "redirect" | "proxy" | "webhook";

/**
 * The routes anyone may call without a token, and who needs them (CLAUDE.md,
 * "Auth and roles"). Every other route must answer 401 without credentials.
 */
export const PUBLIC_ROUTES: Record<string, PublicRouteKind> = {
  // Fly's health check
  "GET /api/v1/health": "json",
  // Guests and embedders: an event, its questions and their live updates
  "GET /api/v1/events/:uid": "json",
  "GET /api/v1/events/:uid/questions": "json",
  "GET /api/v1/events/:uid/questions/stream": "stream",
  // The organizer pages' live updates: carries no data, only "refetch"
  "GET /api/v1/conferences/:id/questions/stream": "stream",
  // The Q&A page's session switcher
  "GET /api/v1/events": "json",
  // Old Event Card links, redirected to the Q&A page
  "GET /e/:uid/card": "redirect",
  // Signage and printed QR codes (the stage screen /stage/:stage is a page)
  "GET /stage/:stage/qa": "redirect",
  "GET /api/v1/events/stage/:stage/live": "json",
  "GET /api/v1/conferences/:id/live": "redirect",
  // posthog-js in every browser, through our proxy to PostHog
  "GET /relay/*": "proxy",
  "POST /relay/*": "proxy",
  // The Devcon team's webhook; it only re-pulls a public schedule
  "POST /api/v1/pretalx/:event/sync": "webhook",
};

/**
 * Routes that change questions or votes: each must notify the event's stream
 * (`notifyQuestionsChanged`), which integration/realtime.int.ts checks for
 * every one of them.
 */
export const QUESTION_MUTATIONS = [
  "POST /api/v1/events/:uid/questions",
  "POST /api/v1/questions/:uid/upvote",
  "POST /api/v1/questions/:uid/select",
  "POST /api/v1/questions/:uid/mark-as-answered",
  "POST /api/v1/questions/:uid/hide",
  "POST /api/v1/questions/:uid/restore",
  // Their questions leave every list
  "POST /api/v1/users/:uid/block",
];

/** Every other route that writes, and why it sends no question update. */
export const OTHER_MUTATIONS: Record<string, string> = {
  "POST /api/v1/events/:uid/react": "sends a `reaction` message instead",
  "POST /api/v1/events/:uid/live": "sends a `live` message instead",
  "POST /api/v1/events/:uid/high-engagement":
    "notifies the presenter view itself (high-engagement.int.ts)",
  "POST /api/v1/conferences/:id/permissions": "roles, not questions",
  "DELETE /api/v1/conferences/:id/permissions/members/:userId": "roles, not questions",
  "DELETE /api/v1/conferences/:id/permissions/invitations/:invitationId":
    "roles, not questions",
  "POST /api/v1/admin/conferences": "schedule imports, not questions",
  "POST /api/v1/admin/events": "schedule imports, not questions",
  "POST /api/v1/pretalx/:event/sync": "schedule imports, not questions",
  "POST /relay/*": "forwards analytics to PostHog",
};
