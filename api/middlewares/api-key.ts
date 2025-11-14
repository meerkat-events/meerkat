import { createMiddleware } from "@hono/hono/factory";
import { HTTPException } from "@hono/hono/http-exception";
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
 * Validates an API key against the database. Fetching all API keys from the database and verifying the key against the hashed key is
 * highly inefficient. This should be improved in the future.
 * @param key - The API key to validate
 * @returns The API key if it is valid, otherwise null
 */
async function getApiKey(key: string) {
  const allKeys = await getAllApiKeys();

  for (const apiKey of allKeys) {
    const matches = await verify(apiKey.hashedKey, key);

    if (matches) {
      return apiKey;
    }
  }

  return null;
}
