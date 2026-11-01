import assert from "node:assert/strict";
import { test } from "node:test";
import { posthogAssetsHost, posthogUiHost } from "./posthog-hosts.ts";

// app.ts reads the environment when it is imported (env.ts), so placeholders
// go in first. PostHog requests never leave the process: fetch is replaced
// below.
process.env["DATABASE_URL"] = "postgres://placeholder@127.0.0.1:1/none";
process.env["DEVCON_VERIFICATION_SECRET"] = "placeholder";
process.env["SUPABASE_SERVICE_ROLE_KEY"] = "placeholder";
process.env["POSTHOG_PROJECT_TOKEN"] = "phc_placeholder";
process.env["POSTHOG_HOST"] = "https://eu.i.posthog.com";

const { upstreamRequestHeaders, upstreamUrl } = await import(
  "./routes/posthog-proxy.ts"
);
const { default: app } = await import("./app.ts");

test("PostHog Cloud hosts map to their region's assets and app hosts", () => {
  assert.equal(
    posthogAssetsHost("https://eu.i.posthog.com"),
    "https://eu-assets.i.posthog.com",
  );
  assert.equal(posthogUiHost("https://us.i.posthog.com"), "https://us.posthog.com");
  assert.equal(
    posthogAssetsHost("https://posthog.example.com"),
    "https://posthog.example.com",
  );
  assert.equal(posthogUiHost("https://posthog.example.com"), undefined);
});

test("scripts come from the assets host, everything else from ingestion", () => {
  const host = "https://eu.i.posthog.com";
  assert.equal(
    upstreamUrl(host, "/static/array.js", "").href,
    "https://eu-assets.i.posthog.com/static/array.js",
  );
  assert.equal(
    upstreamUrl(host, "/array/phc_x/config.js", "").href,
    "https://eu-assets.i.posthog.com/array/phc_x/config.js",
  );
  assert.equal(
    upstreamUrl(host, "/e/", "?ip=0&ver=1").href,
    "https://eu.i.posthog.com/e/?ip=0&ver=1",
  );
});

test("a path can't send the request to another host", () => {
  const url = upstreamUrl("https://eu.i.posthog.com", "//elsewhere.example/e/", "");
  assert.equal(url.host, "eu.i.posthog.com");
});

test("cookies and credentials stay here; the attendee's IP goes along", () => {
  const request = new Request("http://localhost/relay/e/", {
    headers: {
      "cookie": "session=secret",
      "authorization": "Bearer eyJsupabase",
      "x-forwarded-for": "10.0.0.1",
      "fly-client-ip": "203.0.113.7",
      "content-type": "text/plain",
    },
  });
  const headers = upstreamRequestHeaders(request);
  assert.equal(headers.get("cookie"), null);
  assert.equal(headers.get("authorization"), null);
  assert.equal(headers.get("x-forwarded-for"), "203.0.113.7");
  assert.equal(headers.get("x-real-ip"), "203.0.113.7");
  assert.equal(headers.get("content-type"), "text/plain");

  const withToken = new Request("http://localhost/relay/flags", {
    headers: { authorization: "Bearer phc_placeholder" },
  });
  assert.equal(
    upstreamRequestHeaders(withToken).get("authorization"),
    "Bearer phc_placeholder",
  );
});

test("a request through the app reaches PostHog and its answer comes back", async (t) => {
  const forwarded: Request[] = [];
  t.mock.method(globalThis, "fetch", (input: URL, init: RequestInit) => {
    forwarded.push(new Request(input, init));
    return Promise.resolve(
      new Response('{"status":1}', {
        status: 200,
        headers: { "content-type": "application/json", "set-cookie": "a=b" },
      }),
    );
  });

  const response = await app.request("/relay/e/?ver=1", {
    method: "POST",
    headers: { "content-type": "text/plain", "cookie": "session=secret" },
    body: "payload",
  });

  assert.equal(response.status, 200);
  assert.equal(await response.text(), '{"status":1}');
  assert.equal(response.headers.get("set-cookie"), null);
  const [request] = forwarded;
  assert.ok(request);
  assert.equal(request.url, "https://eu.i.posthog.com/e/?ver=1");
  assert.equal(request.method, "POST");
  assert.equal(request.headers.get("cookie"), null);
  assert.equal(await request.text(), "payload");
});

test("an unreachable PostHog answers 502", async (t) => {
  t.mock.method(globalThis, "fetch", () =>
    Promise.reject(new TypeError("fetch failed")));
  const response = await app.request("/relay/flags?v=2");
  assert.equal(response.status, 502);
});
