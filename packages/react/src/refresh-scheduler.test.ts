import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { createRefreshScheduler } from "./refresh-scheduler.ts";

const MAX_DELAY_MS = 1500;

/** Lets awaited promises settle (setImmediate isn't mocked). */
function settle(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/** A refresh whose requests stay in flight until `finish` is called. */
function controlledRefresh() {
  const pending: Array<() => void> = [];
  let calls = 0;
  return {
    refresh: () => {
      calls++;
      return new Promise<void>((resolve) => pending.push(resolve));
    },
    get calls() {
      return calls;
    },
    get inFlight() {
      return pending.length;
    },
    async finish() {
      pending.shift()?.();
      await settle();
    },
  };
}

describe("createRefreshScheduler", () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ["setTimeout"] });
    mock.method(Math, "random", () => 0.5);
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it("waits a random delay before refreshing", () => {
    const refresh = controlledRefresh();
    const scheduler = createRefreshScheduler(refresh.refresh, MAX_DELAY_MS);

    scheduler.schedule();
    mock.timers.tick(MAX_DELAY_MS * 0.5 - 1);
    assert.equal(refresh.calls, 0);

    mock.timers.tick(1);
    assert.equal(refresh.calls, 1);
  });

  it("covers updates during the wait with the one refresh", async () => {
    const refresh = controlledRefresh();
    const scheduler = createRefreshScheduler(refresh.refresh, MAX_DELAY_MS);

    scheduler.schedule();
    scheduler.schedule();
    scheduler.schedule();
    mock.timers.tick(MAX_DELAY_MS);
    await refresh.finish();
    mock.timers.tick(MAX_DELAY_MS);

    assert.equal(refresh.calls, 1);
  });

  it("collapses updates during a refresh into one follow-up", async () => {
    const refresh = controlledRefresh();
    const scheduler = createRefreshScheduler(refresh.refresh, MAX_DELAY_MS);

    scheduler.schedule();
    mock.timers.tick(MAX_DELAY_MS);
    scheduler.schedule();
    scheduler.schedule();
    mock.timers.tick(MAX_DELAY_MS);

    // Never two at once: the follow-up waits for the first to settle.
    assert.equal(refresh.calls, 1);
    assert.equal(refresh.inFlight, 1);

    await refresh.finish();
    mock.timers.tick(MAX_DELAY_MS);
    assert.equal(refresh.calls, 2);

    await refresh.finish();
    mock.timers.tick(MAX_DELAY_MS);
    assert.equal(refresh.calls, 2);
  });

  it("keeps scheduling after a failed refresh", async () => {
    let calls = 0;
    const scheduler = createRefreshScheduler(() => {
      calls++;
      return Promise.reject(new Error("offline"));
    }, MAX_DELAY_MS);

    scheduler.schedule();
    mock.timers.tick(MAX_DELAY_MS);
    await settle();
    scheduler.schedule();
    mock.timers.tick(MAX_DELAY_MS);

    assert.equal(calls, 2);
  });

  it("drops the waiting refresh and the follow-up on cancel", async () => {
    const refresh = controlledRefresh();
    const scheduler = createRefreshScheduler(refresh.refresh, MAX_DELAY_MS);

    scheduler.schedule();
    scheduler.cancel();
    mock.timers.tick(MAX_DELAY_MS);
    assert.equal(refresh.calls, 0);

    scheduler.schedule();
    mock.timers.tick(MAX_DELAY_MS);
    scheduler.schedule();
    scheduler.cancel();
    await refresh.finish();
    mock.timers.tick(MAX_DELAY_MS);
    assert.equal(refresh.calls, 1);
  });
});
