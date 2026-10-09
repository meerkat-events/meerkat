import type { MiddlewareHandler } from "hono";
import { jwk } from "hono/jwk";
import { type JwtVariables, verifyWithJwks } from "hono/jwt";
import type { HonoJsonWebKey } from "hono/utils/jwt/jws";
import env from "../env.ts";
import logger from "../logger.ts";

const JWKS_URI = `${env.supabaseUrl}/auth/v1/.well-known/jwks.json`;
const ALGORITHMS: ("RS256" | "ES256")[] = ["RS256", "ES256"];

/**
 * Supabase's signing keys change rarely and new ones are published before
 * use, so a short cache is safe. Without it every verified request, including
 * every question list refetch, would fetch the key set again.
 */
const JWKS_MAX_AGE_MS = 10 * 60 * 1000;

let cachedKeys: { keys: Promise<HonoJsonWebKey[]>; fetchedAt: number } | null =
  null;

async function fetchSigningKeys(): Promise<HonoJsonWebKey[]> {
  const response = await fetch(JWKS_URI);
  if (!response.ok) {
    throw new Error(`Failed to fetch JWKS: HTTP ${response.status}`);
  }
  const body = await response.json() as { keys?: unknown };
  if (!Array.isArray(body.keys)) {
    throw new Error("JWKS response has no keys");
  }
  return body.keys as HonoJsonWebKey[];
}

/** The signing keys, fetched at most once per JWKS_MAX_AGE_MS. */
function getSigningKeys(): Promise<HonoJsonWebKey[]> {
  if (
    cachedKeys !== null && Date.now() - cachedKeys.fetchedAt < JWKS_MAX_AGE_MS
  ) {
    return cachedKeys.keys;
  }

  // Concurrent requests share one fetch; a failed fetch is not cached.
  const keys = fetchSigningKeys();
  cachedKeys = { keys, fetchedAt: Date.now() };
  keys.catch((error) => {
    logger.warn({ error }, "Failed to fetch Supabase JWKS");
    if (cachedKeys?.keys === keys) {
      cachedKeys = null;
    }
  });
  return keys;
}

/** Requires a valid Supabase access token; `jwtPayload.sub` is the user id. */
export const jwt: () => MiddlewareHandler<
  { Variables: JwtVariables }
> = () =>
  jwk({
    keys: () => getSigningKeys(),
    alg: ALGORITHMS,
  });

/**
 * Sets `jwtPayload` when the request carries a valid Supabase access token and
 * lets every request through otherwise. An expired or invalid token counts as
 * anonymous instead of failing, so public endpoints keep working for viewers
 * whose session is about to refresh.
 */
export const optionalJwt: () => MiddlewareHandler<
  { Variables: Partial<JwtVariables> }
> = () => async (c, next) => {
  const header = c.req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";

  if (token) {
    try {
      const payload = await verifyWithJwks(token, {
        keys: await getSigningKeys(),
        allowedAlgorithms: ALGORITHMS,
      });
      c.set("jwtPayload", payload);
    } catch {
      // Anonymous: the endpoint behaves as for a visitor without a token.
    }
  }

  await next();
};
