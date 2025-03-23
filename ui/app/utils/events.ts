import type { Event } from "../types.ts";

export const pageTitle = (event: Event | undefined) => {
  if (event) {
    return `${event.title} | ${event.uid} | Meerkat`;
  }
  return "Engaging conferences | Meerkat";
};
