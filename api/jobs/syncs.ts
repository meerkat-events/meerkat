type SyncConfig = {
  pretalxApiEvents: string;
  meerkatApiEvents: string;
  meerkatApiKey: string;
};

const syncConfigsString = Deno.env.get("SYNC_CONFIGS");

if (!syncConfigsString) {
  throw new Error("SYNC_CONFIGS is not set");
}

const syncConfigs: SyncConfig[] = JSON.parse(syncConfigsString);

type EventsResponse = {
  count: number;
  next: string;
  previous: string | null;
  results: Event[];
};

type Event = {
  code: string;
  speakers: {
    name: string;
  }[];
  title: string;
  abstract: string;
  description: string;
  track: Record<string, string>;
  submission_type: Record<string, string>;
  slot: {
    start: string;
    end: string;
  };
};

for (const syncConfig of syncConfigs) {
  await sync(syncConfig);
}

async function sync(syncConfig: SyncConfig) {
  const eventsRequest = await fetch(syncConfig.pretalxApiEvents);
  const eventsResponse: EventsResponse = await eventsRequest.json();

  const meerkatEvents = eventsResponse.results.map((event) => {
    return {
      uid: event.code,
      title: event.title,
      submissionType: event.submission_type["en"],
      start: event.slot.start,
      end: event.slot.end,
      abstract: event.abstract,
      description: event.description,
      track: event.track["en"],
      speaker: event.speakers.map((speaker) => speaker.name).join(", "),
    };
  });

  for (let i = 0; i < meerkatEvents.length; i += 50) {
    const batch = meerkatEvents.slice(i, i + 50);
    const meerkatEventsRequest = await fetch(syncConfig.meerkatApiEvents, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${syncConfig.meerkatApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batch),
    });
    if (!meerkatEventsRequest.ok) {
      console.error(await meerkatEventsRequest.json());
    }
  }

  console.info(
    `Synced ${meerkatEvents.length} events from ${syncConfig.pretalxApiEvents}`,
  );
}
