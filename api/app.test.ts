import assert from "node:assert/strict";
import { test } from "node:test";

// app.ts reads the environment when it is imported (env.ts), so placeholders
// go in first. None of them points anywhere real: the requests below are
// turned away by the auth middleware before any route reaches the database
// or Supabase.
process.env["DATABASE_POOLER_URL"] = "postgres://placeholder@127.0.0.1:1/none";
process.env["PRIVATE_KEY"] = "placeholder";
process.env["DEVCON_VERIFICATION_SECRET"] = "placeholder";
process.env["SUPABASE_SERVICE_ROLE_KEY"] = "placeholder";
delete process.env["SUPABASE_URL"];
delete process.env["SUPABASE_ANON_KEY"];

const { default: app } = await import("./app.ts");

/**
 * The routes anyone may call without a token, and who needs them (CLAUDE.md,
 * "Auth and roles"). Every other route must answer 401 without credentials.
 */
const PUBLIC_ROUTES = [
  // Every page, before a session exists: the Supabase URL and anon key
  "GET /api/v1/config",
  // Fly's health check
  "GET /api/v1/health",
  // Guests and embedders: an event, its questions and their live updates
  "GET /api/v1/events/:uid",
  "GET /api/v1/events/:uid/questions",
  "GET /api/v1/events/:uid/questions/stream",
  // The Q&A page's session switcher
  "GET /api/v1/events",
  // Signage and printed QR codes
  "GET /stage/:stage",
  "GET /stage/:stage/qa",
  "GET /api/v1/events/stage/:stage/live",
  "GET /api/v1/conferences/:id/live",
  // The Devcon team's webhook; it only re-pulls a public schedule
  "POST /api/v1/pretalx/:event/sync",
];

/** Each route once, as "METHOD /path" (middlewares register their own rows). */
function registeredRoutes() {
  const routes = new Set<string>();
  for (const route of app.routes) {
    if (route.method === "ALL") continue;
    routes.add(`${route.method} ${route.path}`);
  }
  return [...routes];
}

/** A concrete URL for a route pattern: every `:param` becomes "test". */
function samplePath(pattern: string) {
  return pattern.replace(/:[^/]+/g, "test");
}

test("every public route exists", () => {
  const routes = registeredRoutes();
  for (const publicRoute of PUBLIC_ROUTES) {
    assert.ok(routes.includes(publicRoute), `${publicRoute} is not registered`);
  }
});

test("every other route answers 401 without credentials", async () => {
  const protectedRoutes = registeredRoutes().filter((route) =>
    !PUBLIC_ROUTES.includes(route)
  );
  assert.ok(protectedRoutes.length > 0);

  for (const route of protectedRoutes) {
    const [method, pattern] = route.split(" ") as [string, string];
    const response = await app.request(samplePath(pattern), { method });
    assert.equal(response.status, 401, `${route} answered ${response.status}`);
  }
});
