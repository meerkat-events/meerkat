import { HTTPError } from "./http-error.ts";
import { extractHTTPError } from "./request.ts";

const SHARED_HEADERS = {
  "Accept": "application/json",
  "Content-Type": "application/json",
};

export const fetcher = async (endpoint: string, token?: string) => {
  const res = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, {
    headers: {
      ...SHARED_HEADERS,
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    throw new HTTPError(res);
  }
  return res.json();
};

export const poster = async (
  endpoint: string,
  { arg }: { arg: Record<string, unknown> },
  token?: string,
) => {
  const res = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, {
    method: "POST",
    headers: {
      ...SHARED_HEADERS,
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    },
    body: arg ? JSON.stringify(arg) : undefined,
  });
  if (!res.ok) {
    throw await extractHTTPError(res);
  }
  return res.json();
};

export const deleter = async (endpoint: string, token?: string) => {
  const res = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, {
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
