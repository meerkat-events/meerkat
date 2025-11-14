import { apiKeys } from "../schema.ts";
import db from "../db.ts";

export async function getAllApiKeys() {
  return await db.select().from(apiKeys).execute();
}

export type ApiKey = typeof apiKeys.$inferSelect;
