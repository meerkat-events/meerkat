import { HTTPError } from "./http-error.ts";
import { extractHTTPError } from "./request.ts";

const SHARED_HEADERS = {
  "Accept": "application/json",
  "Content-Type": "application/json",
};

export const fetcher = async (endpoint: string) => {
  const res = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, {
    headers: SHARED_HEADERS,
    credentials: "include",
  });
  if (!res.ok) {
    throw new HTTPError(res);
  }
  return res.json();
};

export const poster = async (
  endpoint: string,
  { arg }: { arg: Record<string, unknown> },
) => {
  const res = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, {
    method: "POST",
    credentials: "include",
    ...(arg
      ? {
        headers: SHARED_HEADERS,
        body: JSON.stringify(arg),
      }
      : {}),
  });
  if (!res.ok) {
    throw await extractHTTPError(res);
  }
  return res.json();
};

export const deleter = async (endpoint: string) => {
  const res = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, {
    headers: SHARED_HEADERS,
    credentials: "include",
    method: "DELETE",
  });
  if (!res.ok) {
    throw new HTTPError(res);
  }
};
