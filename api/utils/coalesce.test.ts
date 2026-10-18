import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { coalesce } from "./coalesce.ts";

const WINDOW_MS = 1000;

describe("coalesce", () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ["setTimeout"] });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it("runs the first trigger immediately", () => {
    let runs = 0;
    const coalescer = coalesce(() => runs++, WINDOW_MS);

    coalescer.trigger();

    assert.equal(runs, 1);
  });

  it("collapses triggers during the window into one trailing run", () => {
    let runs = 0;
    const coalescer = coalesce(() => runs++, WINDOW_MS);

    coalescer.trigger();
    mock.timers.tick(100);
    coalescer.trigger();
    coalescer.trigger();
    coalescer.trigger();
    assert.equal(runs, 1);

    mock.timers.tick(WINDOW_MS - 100);
    assert.equal(runs, 2);
  });

  it("runs at most once per window under a steady stream of triggers", () => {
    let runs = 0;
    const coalescer = coalesce(() => runs++, WINDOW_MS);

    // 10 triggers a second for 5 seconds.
    for (let i = 0; i < 50; i++) {
      coalescer.trigger();
      mock.timers.tick(100);
    }

    // The leading run plus one at the end of each window (1 s, 2 s, ... 5 s).
    assert.equal(runs, 6);

    // Nothing arrived since the run at 5 s, so there is no further run.
    mock.timers.tick(WINDOW_MS);
    assert.equal(runs, 6);
  });

  it("has no trailing run when nothing arrived during the window", () => {
    let runs = 0;
    const coalescer = coalesce(() => runs++, WINDOW_MS);

    coalescer.trigger();
    mock.timers.tick(WINDOW_MS * 3);

    assert.equal(runs, 1);
  });

  it("runs immediately again once a window ended idle", () => {
    let runs = 0;
    let idles = 0;
    const coalescer = coalesce(() => runs++, WINDOW_MS, () => idles++);

    coalescer.trigger();
    mock.timers.tick(WINDOW_MS);
    assert.equal(idles, 1);

    coalescer.trigger();
    assert.equal(runs, 2);
  });

  it("goes idle only after the trailing run's window ends too", () => {
    let idles = 0;
    const coalescer = coalesce(() => {}, WINDOW_MS, () => idles++);

    coalescer.trigger();
    coalescer.trigger();
    mock.timers.tick(WINDOW_MS);
    assert.equal(idles, 0);

    mock.timers.tick(WINDOW_MS);
    assert.equal(idles, 1);
  });

  it("drops the pending run on cancel", () => {
    let runs = 0;
    const coalescer = coalesce(() => runs++, WINDOW_MS);

    coalescer.trigger();
    coalescer.trigger();
    coalescer.cancel();
    mock.timers.tick(WINDOW_MS * 2);

    assert.equal(runs, 1);
  });
});
