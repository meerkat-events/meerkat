import type { Event } from "../types.ts";

export const pageTitle = (event: Event) =>
  `${event.title} | ${event.uid} | Meerkat`;
