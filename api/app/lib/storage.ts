/**
 * localStorage for small per-device preferences. It doesn't exist during the
 * server render and throws when the browser blocks it (private browsing,
 * blocked site data), so both helpers swallow every error: what we remember
 * there is never more than a convenience.
 */

/**
 * The stored value: null when nothing is stored under `key`, undefined when
 * storage can't be read at all.
 */
export function readStorage(key: string): string | null | undefined {
  try {
    return globalThis.localStorage?.getItem(key);
  } catch {
    return undefined;
  }
}

/** Stores `value` under `key`, or removes the key when `value` is null. */
export function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) {
      globalThis.localStorage?.removeItem(key);
    } else {
      globalThis.localStorage?.setItem(key, value);
    }
  } catch {
    // Blocked storage: the preference is forgotten, which is harmless.
  }
}
