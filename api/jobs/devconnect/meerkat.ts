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

export async function upsertEvents(
  client: MeerkatClient,
  events: Array<{
    conferenceId: number;
    uid: string;
    title: string;
    start: Date;
    end: Date;
    speaker?: string;
    stage?: string;
  }>,
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
