import { sql } from "drizzle-orm";
import db from "../db.ts";

/** Throws when the database can't be reached. */
export async function pingDatabase() {
  await db.execute(sql`SELECT 1`);
}
