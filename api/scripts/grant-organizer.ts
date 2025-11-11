import "@std/dotenv/load";
import { grantRole } from "../models/roles.ts";
import db from "../db.ts";

const args = Deno.args;

if (args.length !== 2) {
  console.error("Usage: deno run grant-organizer.ts <userId> <conferenceId>");
  Deno.exit(1);
}

const userId = args[0];
const conferenceId = parseInt(args[1], 10);

if (!userId || isNaN(conferenceId)) {
  console.error("Both userId and conferenceId must be valid numbers");
  Deno.exit(1);
}

try {
  await grantRole(userId, conferenceId, "organizer");
  console.log(
    `✓ Granted organizer role to user ${userId} for conference ${conferenceId}`,
  );
} catch (error) {
  console.error("Failed to grant role:", error);
  Deno.exit(1);
} finally {
  await db.$client.end();
}
