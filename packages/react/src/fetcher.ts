export class FetchError extends Error {
  status: number;
  statusText: string;
  body: string | undefined;

  constructor(status: number, statusText: string, body?: string) {
    const message = body
      ? `Fetch error ${status}: ${body}`
      : `Fetch error ${status}: ${statusText}`;
    super(message);
    this.name = "FetchError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

export function createFetcher(apiUrl: string) {
  return async (endpoint: string) => {
    const res = await fetch(`${apiUrl}${endpoint}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      let body: string | undefined;
      try {
        body = await res.text();
      } catch {}
      throw new FetchError(res.status, res.statusText, body);
    }
    return res.json();
  };
}
