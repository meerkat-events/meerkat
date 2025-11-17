import { slugify } from "../../utils/slugify.ts";
import {
  createDevconnectClient,
  fetchEvents,
  fetchSessionsByEvent,
  SessionByEvent,
} from "./api.ts";
import { parseEventSessions } from "./parse.ts";
import {
  createConference,
  createMeerkatClient,
  fetchConferences,
} from "./meerkat.ts";
import { writeSessionsCSV } from "./csv.ts";
import { upsertEvents } from "./meerkat.ts";
import { devconnect } from "~/theme/index.ts";

const API_KEY = Deno.env.get("IMPORT_API_KEY");
const DEVCONNECT_BASE = Deno.env.get("DEVCONNECT_BASE") ??
  "https://devconnect.pblvrt.com";
const MEERKAT_BASE = Deno.env.get("MEERKAT_BASE") ?? "http://localhost:8000";

if (!API_KEY) {
  throw new Error("IMPORT_API_KEY environment variable is required");
}

const devconnectClient = createDevconnectClient({ baseUrl: DEVCONNECT_BASE });
const meerkatClient = createMeerkatClient({
  baseUrl: MEERKAT_BASE,
  apiKey: API_KEY,
});

await Deno.mkdir("reports", { recursive: true });

const devconnectEvents = await fetchEvents(devconnectClient);

console.info(`Found ${devconnectEvents.length} devconnect events`);

const conferences = await fetchConferences(meerkatClient);

console.info(`Found ${conferences.length} conferences`);

for (const event of devconnectEvents) {
  let conference = conferences.find((conference) =>
    conference.externalId === event.folderId
  );

  let eventSessions: SessionByEvent[] = [];
  try {
    eventSessions = await fetchSessionsByEvent(devconnectClient, event);
  } catch (error) {
    console.error(`Failed to fetch sessions by event ${event.name}: ${error}`);
    continue;
  }
  console.info(
    `Found ${eventSessions.length} sessions for event ${event.name} (${event.folderId})`,
  );

  if (!conference) {
    const createdConference = await createConference(meerkatClient, {
      name: event.name,
      logoUrl: "/logo.png",
      externalId: event.folderId,
      theme: devconnect as any,
    });
    conference = createdConference;
    console.info(`Created conference ${conference.id} for event ${event.name}`);
  }

  const { valid: validSessions, invalid: invalidSessions } = parseEventSessions(
    eventSessions,
  );

  console.info(
    `Parsed ${validSessions.length} sessions (${invalidSessions.length} failed parsing)`,
  );

  if (invalidSessions.length > 0) {
    await writeSessionsCSV(
      `reports/invalid-sessions-${slugify(conference.name)}.csv`,
      invalidSessions,
    );
  }

  const events = [];

  for (const session of validSessions) {
    events.push({
      conferenceId: conference.id,
      uid: slugify(`${session.id}-${conference.name}`),
      title: session.title,
      start: session.start,
      end: session.end,
      stage: event.stage,
      description: "",
      cover: "",
      live: false,
      speaker: session.speakers.join(", "),
    });
  }

  try {
    await upsertEvents(meerkatClient, events);
    console.info(`Upserted ${events.length} events for event ${event.name}`);
  } catch (error) {
    console.error(`Failed to upsert events for event ${event.name}: ${error}`);
  }
}

if (typeof self !== "undefined" && "postMessage" in self) {
  self.postMessage({ type: "done" });
}
