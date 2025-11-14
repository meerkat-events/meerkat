export function createDevconnectClient({ baseUrl }: { baseUrl: string }) {
  return {
    base: new URL(baseUrl),
    headers: {
      "Content-Type": "application/json",
    },
  };
}

export type DevconnectClient = ReturnType<typeof createDevconnectClient>;

export async function fetchSessions(
  client: DevconnectClient,
): Promise<unknown[]> {
  const url = new URL("/sessions", client.base);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch sessions: ${response.statusText}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}
