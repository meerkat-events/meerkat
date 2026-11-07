import { apiUrl } from "../lib/api-url.ts";
import { HTTPError } from "./http-error.ts";

function authHeaders(token: string | undefined) {
  return {
    "Accept": "application/json",
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
  };
}

/**
 * The message of an API error response: the text of a plain-text answer
 * (`HTTPException`, `c.text`) or the `error` of a JSON one (`{ error }`).
 * Undefined for anything else, such as a proxy's HTML error page, so
 * `HTTPError` falls back to the status line.
 */
async function readErrorMessage(response: Response) {
  const contentType = response.headers.get("Content-Type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const body: unknown = await response.json();
      if (
        typeof body === "object" && body !== null && "error" in body &&
        typeof body.error === "string"
      ) {
        return body.error;
      }
      return undefined;
    }
    if (contentType.includes("text/plain")) {
      return await response.text();
    }
  } catch (_error) {
    // Unreadable body: the status line will do
  }
  return undefined;
}

/**
 * Sends a request to the API and throws an `HTTPError` with the server's
 * message when it fails.
 */
async function request(
  method: "GET" | "POST" | "DELETE",
  endpoint: string,
  token: string | undefined,
  body?: unknown,
) {
  const response = await fetch(apiUrl(endpoint), {
    method,
    headers: authHeaders(token),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    throw new HTTPError(response, await readErrorMessage(response));
  }
  return response;
}

export const fetcher = async (endpoint: string, token?: string) => {
  const response = await request("GET", endpoint, token);
  return response.json();
};

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
  const response = await request("POST", endpoint, token, arg);
  return response.json();
};

export const deleter = async (endpoint: string, token?: string) => {
  await request("DELETE", endpoint, token);
};
