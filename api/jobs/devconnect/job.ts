import { slugify } from "../../utils/slugify.ts";
import { createDevconnectClient } from "./api.ts";
import { fetchSessions } from "./api.ts";
import { parseSessions } from "./parse.ts";
import { createMeerkatClient } from "./meerkat.ts";
import { createInvalidSessionsCSV } from "./csv.ts";
import { upsertEvents } from "./meerkat.ts";

const API_KEY = Deno.env.get("IMPORT_API_KEY");
const DEVCONNECT_BASE = Deno.env.get("DEVCONNECT_BASE") ??
  "https://devconnect.pblvrt.com";
const MEERKAT_BASE = Deno.env.get("MEERKAT_BASE") ?? "http://localhost:8000";
const EVENT_CONFERENCE_MAP = Deno.env.get("EVENT_CONFERENCE_MAP") ?? "{}";

if (!API_KEY) {
  throw new Error("IMPORT_API_KEY environment variable is required");
}

const conferenceMap = JSON.parse(EVENT_CONFERENCE_MAP) as Record<
  string,
  number
>;

const devconnectClient = createDevconnectClient({ baseUrl: DEVCONNECT_BASE });
const meerkatClient = createMeerkatClient({
  baseUrl: MEERKAT_BASE,
  apiKey: API_KEY,
});

console.info("Starting session import...");

const rawSessions = await fetchSessions(devconnectClient);
console.info(`Fetched ${rawSessions.length} raw sessions`);

const { valid: validSessions, invalid: invalidSessions } = parseSessions(
  rawSessions,
);
console.info(
  `Parsed ${validSessions.length} sessions (${invalidSessions.length} failed parsing)`,
);

// Create CSV with invalid sessions
if (invalidSessions.length > 0) {
  await createInvalidSessionsCSV(invalidSessions);
}

const events: Array<{
  uid: string;
  title: string;
  start: Date;
  end: Date;
  conferenceId: number;
  stage: string;
}> = [];

for (const session of validSessions) {
  const conferenceId = conferenceMap[session.event];
  if (!conferenceId) {
    console.warn(`Conference not found for event "${session.event}"`);
    continue;
  }
  events.push({
    conferenceId,
    uid: slugify(session.title),
    title: session.title,
    start: session.start,
    stage: session.stage,
    end: session.end,
  });
}

await upsertEvents(meerkatClient, events);

console.info("\nSession import completed!");

if (typeof self !== "undefined" && "postMessage" in self) {
  self.postMessage({ type: "done" });
}
