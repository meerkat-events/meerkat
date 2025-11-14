import { apiKeys } from "../schema.ts";
import db from "../db.ts";

export type ApiKey = typeof apiKeys.$inferSelect;

export async function getAllApiKeys() {
  return await db.select().from(apiKeys).execute();
}
