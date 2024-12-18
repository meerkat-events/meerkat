import { HTTPError } from "./http-error.ts";
import { extractHTTPError } from "./request.ts";

export const fetcher = async (endpoint: string) => {
  const res = await fetch(endpoint, {
    headers: {
      "accept": "application/json",
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
) => {
  const res = await fetch(endpoint, {
    method: "POST",
    ...(arg
      ? {
        headers: {
          "content-type": "application/json",
        },
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
  const res = await fetch(endpoint, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new HTTPError(res);
  }
};
