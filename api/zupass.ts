import { POD, PODEntries } from "@pcd/pod";
import env from "./env.ts";
import type { Event } from "./models/events.ts";
import type { Conference } from "./models/conferences.ts";

const url = new URL(env.base);
const reversedDomain = url.hostname.split(".").reverse().join(".");

export function createAttendancePOD(
  conference: Conference,
  event: Event,
  owner: string,
) {
  const entries: PODEntries = {
    "owner": {
      type: "eddsa_pubkey",
      value: owner,
    },
    "pod_type": {
      type: "string",
      value: `${reversedDomain}/attendance`,
    },
    "version": {
      type: "string",
      value: "1.0.0",
    },
    "zupass_display": {
      type: "string",
      value: "collectable",
    },
    "zupass_image_url": {
      type: "string",
      value: event.cover ??
        "https://icnyvghgspgzemdudsrd.supabase.co/storage/v1/object/public/global/logo.png",
    },
    "zupass_title": {
      type: "string",
      value: event.title,
    },
    "zupass_description": {
      type: "string",
      value: event.description ?? "",
    },
    "start_date": {
      type: "date",
      value: event.start,
    },
    "end_date": {
      type: "date",
      value: event.end,
    },
    "conference": {
      type: "string",
      value: conference.name,
    },
    "track": {
      type: "string",
      value: event.track ?? "",
    },
    "code": {
      type: "string",
      value: event.uid,
    },
  };

  return POD.sign(entries, env.privateKey);
}
