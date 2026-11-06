import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { readStorage, writeStorage } from "./storage.ts";

const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

/** Replaces `globalThis.localStorage` with `storage` for one test. */
function stubStorage(storage: () => unknown) {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get: storage,
  });
}

/** A Map-backed stand-in for the browser's localStorage. */
function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => items.set(key, value),
    removeItem: (key: string) => items.delete(key),
  };
}

afterEach(() => {
  if (original) {
    Object.defineProperty(globalThis, "localStorage", original);
  } else {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  }
});

test("a stored value reads back, and writing null removes it", () => {
  const storage = memoryStorage();
  stubStorage(() => storage);

  assert.equal(readStorage("key"), null);
  writeStorage("key", "value");
  assert.equal(readStorage("key"), "value");
  writeStorage("key", null);
  assert.equal(readStorage("key"), null);
});

test("blocked storage reads as undefined and ignores writes", () => {
  stubStorage(() => {
    throw new DOMException("Access denied", "SecurityError");
  });

  assert.equal(readStorage("key"), undefined);
  assert.doesNotThrow(() => writeStorage("key", "value"));
  assert.doesNotThrow(() => writeStorage("key", null));
});

test("missing storage, as during the server render, reads as undefined", () => {
  stubStorage(() => undefined);

  assert.equal(readStorage("key"), undefined);
  assert.doesNotThrow(() => writeStorage("key", "value"));
});
