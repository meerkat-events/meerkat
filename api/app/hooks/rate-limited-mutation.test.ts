import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import useSWRMutation from "swr/mutation";
import { HTTPError } from "./http-error.ts";
import { rateLimitedMutationOptions } from "./rate-limited-mutation.ts";

type Handlers = Parameters<typeof rateLimitedMutationOptions>[0];

/**
 * Renders a component once to get the `trigger` of a real `useSWRMutation`
 * whose request fails with `status`.
 */
function failingTrigger(key: string, status: number, handlers: Handlers) {
  let trigger: (() => Promise<unknown>) | undefined;
  function Probe() {
    trigger = useSWRMutation(
      key,
      () => Promise.reject(new HTTPError(new Response(null, { status }))),
      rateLimitedMutationOptions(handlers),
    ).trigger;
    return null;
  }
  renderToString(createElement(Probe));
  assert.ok(trigger);
  return trigger;
}

test("a 429 resolves trigger and goes to onRateLimited only", async () => {
  const rateLimited: HTTPError[] = [];
  const errors: HTTPError[] = [];
  const trigger = failingTrigger("/rate-limited", 429, {
    onRateLimited: (error) => rateLimited.push(error),
    onError: (error) => errors.push(error),
  });

  assert.equal(await trigger(), undefined);
  assert.equal(rateLimited.length, 1);
  assert.equal(rateLimited[0]?.status, 429);
  assert.equal(errors.length, 0);
});

test("another error resolves trigger and goes to onError only", async () => {
  const rateLimited: HTTPError[] = [];
  const errors: HTTPError[] = [];
  const trigger = failingTrigger("/server-error", 500, {
    onRateLimited: (error) => rateLimited.push(error),
    onError: (error) => errors.push(error),
  });

  assert.equal(await trigger(), undefined);
  assert.equal(rateLimited.length, 0);
  assert.equal(errors[0]?.status, 500);
});

test("without onError, an error still resolves trigger", async () => {
  const trigger = failingTrigger("/no-handler", 500, {
    onRateLimited: () => {},
    onError: undefined,
  });

  assert.equal(await trigger(), undefined);
});
