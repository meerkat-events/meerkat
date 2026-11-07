import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { getAllApiKeys } from "../models/api-keys.ts";
import { verify } from "argon2";

export const apiKey = () => {
  return createMiddleware(async (c, next) => {
    const key = c.req.header("x-api-key");

    if (!key) {
      throw new HTTPException(401, { message: "API key is required" });
    }

    const apiKey = await getApiKey(key);

    if (!apiKey) {
      throw new HTTPException(401, { message: "Invalid or expired API key" });
    }

    await next();
  });
};

/**
 * The stored key that `key` matches, unless it has expired (`valid_until` in
 * the past; null never expires), otherwise null. Keys are argon2 hashes, so
 * each one is verified in turn; there are only a handful.
 */
async function getApiKey(key: string) {
  const now = new Date();
  const allKeys = await getAllApiKeys();

  for (const apiKey of allKeys) {
    const isExpired = apiKey.validUntil !== null && apiKey.validUntil <= now;
    if (isExpired) {
      continue;
    }

    const matches = await verify(apiKey.hashedKey, key);

    if (matches) {
      return apiKey;
    }
  }

  return null;
}
