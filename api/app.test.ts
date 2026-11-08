import assert from "node:assert/strict";
import { test } from "node:test";

// app.ts reads the environment when it is imported (env.ts), so placeholders
// go in first. None of them points anywhere real: the requests below are
// turned away by the auth middleware before any route reaches the database
// or Supabase.
process.env["DATABASE_URL"] = "postgres://placeholder@127.0.0.1:1/none";
process.env["DEVCON_VERIFICATION_SECRET"] = "placeholder";
process.env["SUPABASE_SERVICE_ROLE_KEY"] = "placeholder";
delete process.env["SUPABASE_URL"];
delete process.env["SUPABASE_ANON_KEY"];

const { default: app } = await import("./app.ts");
const { OTHER_MUTATIONS, PUBLIC_ROUTES, QUESTION_MUTATIONS } = await import(
  "./testing/route-lists.ts"
);

const WRITE_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

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
  for (const publicRoute of Object.keys(PUBLIC_ROUTES)) {
    assert.ok(routes.includes(publicRoute), `${publicRoute} is not registered`);
  }
});

test("every other route answers 401 without credentials", async () => {
  const protectedRoutes = registeredRoutes().filter((route) =>
    !(route in PUBLIC_ROUTES)
  );
  assert.ok(protectedRoutes.length > 0);

  for (const route of protectedRoutes) {
    const [method, pattern] = route.split(" ") as [string, string];
    const response = await app.request(samplePath(pattern), { method });
    assert.equal(response.status, 401, `${route} answered ${response.status}`);
  }
});

test("every route that writes is classified for real-time updates", () => {
  const writes = registeredRoutes().filter((route) =>
    WRITE_METHODS.includes(route.split(" ")[0]!)
  );
  for (const route of writes) {
    const notifies = QUESTION_MUTATIONS.includes(route);
    const exempt = route in OTHER_MUTATIONS;
    assert.ok(
      notifies !== exempt,
      `${route} must be in exactly one of QUESTION_MUTATIONS and OTHER_MUTATIONS (testing/route-lists.ts)`,
    );
  }
  for (const route of [...QUESTION_MUTATIONS, ...Object.keys(OTHER_MUTATIONS)]) {
    assert.ok(writes.includes(route), `${route} is not registered`);
  }
});

test("the stage screen is left to the frontend, not redirected", async () => {
  // main.ts serves pages after the API routes, so /stage/:stage must not
  // match one: React Router renders it in place.
  const response = await app.request("/stage/test");
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("Location"), null);
});

test("every response asks crawlers not to index it", async () => {
  const unauthorized = await app.request("/api/v1/users/me/roles");
  const notFound = await app.request("/nothing-here");
  assert.equal(unauthorized.headers.get("X-Robots-Tag"), "noindex");
  assert.equal(notFound.headers.get("X-Robots-Tag"), "noindex");
});
