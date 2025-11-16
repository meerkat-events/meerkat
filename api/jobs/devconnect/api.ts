export function createDevconnectClient({ baseUrl }: { baseUrl: string }) {
  return {
    base: new URL(baseUrl),
    headers: {
      "Content-Type": "application/json",
    },
  };
}

export type DevconnectClient = ReturnType<typeof createDevconnectClient>;

export type Event = {
  folderId: string;
  name: string;
  sheetId: string;
  sheetName: string;
  stage: string;
  updatedAt: string;
};

export async function fetchEvents(
  client: DevconnectClient,
): Promise<Event[]> {
  const url = new URL("/events", client.base);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch events: ${response.statusText}`);
  }
  return response.json();
}

export type SessionByEvent = {
  id: string;
  title: string;
  day: string;
  type: string;
  start: string;
  timer: string;
  end: string;
  speakers: string[];
};

export async function fetchSessionsByEvent(
  client: DevconnectClient,
  event: Event,
): Promise<SessionByEvent[]> {
  const url = new URL(`/events/${event.folderId}/sessions`, client.base);
  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Failed to fetch sessions by event ${event.name}: ${response.statusText} - ${error}`,
    );
  }

  return response.json();
}

export async function fetchSessions(
  client: DevconnectClient,
): Promise<unknown[]> {
  const url = new URL("/sessions", client.base);
  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Failed to fetch sessions: ${response.statusText} - ${error}`,
    );
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}
