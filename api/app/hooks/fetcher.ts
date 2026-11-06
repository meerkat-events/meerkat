import { apiUrl } from "../lib/api-url.ts";
import { HTTPError } from "./http-error.ts";
import { extractHTTPError } from "./request.ts";
import { countFetch } from "./fetch-activity.ts";

const SHARED_HEADERS = {
  "Accept": "application/json",
  "Content-Type": "application/json",
};

// Counted, so the management pages can show that they are refreshing.
export const fetcher = (endpoint: string, token?: string) =>
  countFetch(async () => {
    const res = await fetch(apiUrl(endpoint), {
      headers: {
        ...SHARED_HEADERS,
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      throw new HTTPError(res);
    }
    return res.json();
  });

/**
 * Every POST goes to a route behind `jwt()`, so the token is a required
 * argument: passing `poster` itself as an SWR fetcher, which would send no
 * token and get 401, doesn't typecheck.
 */
export const poster = async (
  endpoint: string,
  { arg }: { arg: Record<string, unknown> },
  token: string | undefined,
) => {
  const res = await fetch(apiUrl(endpoint), {
    method: "POST",
    headers: {
      ...SHARED_HEADERS,
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    },
    ...(arg ? { body: JSON.stringify(arg) } : {}),
  });
  if (!res.ok) {
    throw await extractHTTPError(res);
  }
  return res.json();
};

export const deleter = async (endpoint: string, token?: string) => {
  const res = await fetch(apiUrl(endpoint), {
    headers: {
      ...SHARED_HEADERS,
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    },
    method: "DELETE",
  });
  if (!res.ok) {
    throw new HTTPError(res);
  }
};
