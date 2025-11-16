import { Event } from "../../models/events.ts";
import { Conference } from "../../models/conferences.ts";

export function createMeerkatClient(
  { baseUrl, apiKey }: { baseUrl: string; apiKey: string },
) {
  return {
    base: new URL(baseUrl),
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
  };
}

export type MeerkatClient = ReturnType<typeof createMeerkatClient>;

export async function fetchConferences(
  client: MeerkatClient,
): Promise<Conference[]> {
  const url = new URL("/api/v1/conferences", client.base);
  const response = await fetch(url, {
    headers: client.headers,
  });
  const { data: conferences } = await response.json();
  return conferences;
}

export async function createConference(
  client: MeerkatClient,
  conference: Omit<Conference, "id">,
) {
  const url = new URL("/api/v1/admin/conferences", client.base);
  const response = await fetch(url, {
    method: "POST",
    headers: client.headers,
    body: JSON.stringify(conference),
  });
  const { data: createdConference } = await response.json();
  return createdConference as Conference;
}

export async function upsertEvents(
  client: MeerkatClient,
  events: Array<Omit<Event, "id">>,
) {
  const url = new URL(
    `/api/v1/admin/events`,
    client.base,
  );
  const response = await fetch(url, {
    method: "POST",
    headers: client.headers,
    body: JSON.stringify(events),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Failed to upsert events: ${response.statusText} - ${error}`,
    );
  }
  return response.json();
}
