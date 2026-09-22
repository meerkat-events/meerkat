import zod from "zod";
import env from "./env.ts";
import logger from "./logger.ts";
import { slugify } from "./utils/slugify.ts";
import { syncConferenceEvents } from "./models/events.ts";
import { claimPretalxSync } from "./models/conferences.ts";

/**
 * Syncs a Pretalx event's released schedule into a conference's events.
 *
 * Source: the public frab export `<PRETALX_URL>/<slug>/schedule/export/schedule.json`
 * (one document, no pagination, no token). One Meerkat event per talk: uid =
 * the Pretalx submission code (what the Devcon app links to), stage = the
 * slugified room. Triggered by `POST /api/v1/pretalx/:event/sync`
 * (routes/pretalx.ts), from Pretalx-side webhooks and `.github/workflows/sync.yml`.
 */

export const PRETALX_EVENT_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/** Pretalx is unreachable or its schedule is unusable (HTTP 502). */
export class PretalxError extends Error {}

const scheduleSchema = zod.object({
  schedule: zod.object({
    version: zod.string(),
    conference: zod.object({
      days: zod.array(zod.object({
        rooms: zod.record(zod.string(), zod.array(zod.unknown())),
      })),
    }),
  }),
});

const talkSchema = zod.object({
  code: zod.string().min(1),
  date: zod.iso.datetime({ offset: true }),
  duration: zod.string().regex(/^\d+:[0-5]\d$/),
  room: zod.string().refine((room) => slugify(room) !== ""),
  title: zod.string().min(1),
  abstract: zod.string().nullish(),
  logo: zod.string().nullish(),
  persons: zod.array(zod.object({ public_name: zod.string() })).default([]),
});

type Talk = zod.infer<typeof talkSchema>;

const talkCodeSchema = zod.object({ code: zod.string().min(1) });

export async function fetchPretalxEvents(pretalxEvent: string) {
  if (!env.pretalxUrl) throw new Error("PRETALX_URL is not set");
  const base = `${env.pretalxUrl}/${pretalxEvent}/`;
  const response = await fetch(new URL("schedule/export/schedule.json", base), {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  }).catch((err: unknown) => {
    throw new PretalxError(`Could not reach Pretalx: ${String(err)}`);
  });

  if (response.status === 404) {
    throw new PretalxError(`Pretalx event "${pretalxEvent}" has no released schedule`);
  }
  if (!response.ok) {
    throw new PretalxError(`Pretalx answered ${response.status} for "${pretalxEvent}"`);
  }

  const parsed = scheduleSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    throw new PretalxError(`Unexpected Pretalx schedule format for "${pretalxEvent}"`);
  }
  const { schedule } = parsed.data;

  const talks = new Map<string, Talk>();
  // Codes of every talk in the schedule, valid or not: an invalid talk is
  // skipped but must not be deleted as "gone from Pretalx".
  const presentUids = new Set<string>();
  const invalid: string[] = [];
  let total = 0;

  for (const day of schedule.conference.days) {
    for (const raw of Object.values(day.rooms).flat()) {
      total++;
      const talk = talkSchema.safeParse(raw);
      if (!talk.success) {
        const code = talkCodeSchema.safeParse(raw).data?.code;
        if (code) presentUids.add(code);
        invalid.push(code ?? "(no code)");
        logger.warn(
          { pretalxEvent, code, issues: talk.error.issues },
          "Skipping invalid Pretalx talk",
        );
        continue;
      }
      presentUids.add(talk.data.code);
      // A talk with several slots keeps its earliest one.
      const existing = talks.get(talk.data.code);
      if (!existing || Date.parse(talk.data.date) < Date.parse(existing.date)) {
        talks.set(talk.data.code, talk.data);
      }
    }
  }

  // Guards against format drift or an unpublished schedule wiping events.
  if (talks.size === 0) {
    throw new PretalxError(`Pretalx schedule for "${pretalxEvent}" has no valid talks`);
  }
  if (invalid.length > total / 2) {
    throw new PretalxError(
      `${invalid.length} of ${total} Pretalx talks for "${pretalxEvent}" are invalid`,
    );
  }

  return {
    version: schedule.version,
    events: [...talks.values()].map((talk) => toEvent(talk, base)),
    presentUids: [...presentUids],
    invalid,
  };
}

function toEvent(talk: Talk, base: string) {
  const start = new Date(talk.date);
  const [hours = 0, minutes = 0] = talk.duration.split(":").map(Number);
  return {
    uid: talk.code,
    title: talk.title,
    start,
    end: new Date(start.getTime() + (hours * 60 + minutes) * 60_000),
    stage: slugify(talk.room),
    description: talk.abstract || null,
    cover: coverUrl(talk.logo, base),
    speaker: talk.persons.map((person) => person.public_name).join(", ") ||
      null,
  };
}

function coverUrl(logo: string | null | undefined, base: string) {
  if (!logo) return null;
  try {
    const url = new URL(logo, base);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export async function syncPretalxConference(
  conference: { id: number; pretalxEvent: string },
) {
  const { version, events, presentUids, invalid } = await fetchPretalxEvents(
    conference.pretalxEvent,
  );
  const result = await syncConferenceEvents(conference.id, events, presentUids);

  const log = {
    conferenceId: conference.id,
    pretalxEvent: conference.pretalxEvent,
    version,
    events: events.length,
    upserted: result.upserted.length,
    deleted: result.deleted,
    kept: result.kept,
    conflicts: result.conflicts,
    invalid,
  };
  if (result.kept.length || result.conflicts.length || invalid.length) {
    logger.warn(log, "Synced Pretalx schedule with issues");
  } else {
    logger.info(log, "Synced Pretalx schedule");
  }

  return { version, ...result, invalid };
}

export type PretalxSyncTrigger =
  | { status: "unknown" }
  | { status: "queued"; retryAfter: number }
  | { status: "synced"; result: Awaited<ReturnType<typeof syncPretalxConference>> };

const trailingSyncs = new Map<string, NodeJS.Timeout>();

/**
 * Syncs now if the cooldown allows, otherwise queues one sync on this
 * instance for when it ends, so the last change in a burst is not dropped.
 */
export async function triggerPretalxSync(
  pretalxEvent: string,
): Promise<PretalxSyncTrigger> {
  const claim = await claimPretalxSync(pretalxEvent);
  if (!claim) return { status: "unknown" };

  if (!claim.claimed) {
    scheduleTrailingSync(pretalxEvent, claim.retryAfter);
    return { status: "queued", retryAfter: claim.retryAfter };
  }

  const result = await syncPretalxConference({
    id: claim.conferenceId,
    pretalxEvent,
  });
  return { status: "synced", result };
}

function scheduleTrailingSync(pretalxEvent: string, seconds: number) {
  if (trailingSyncs.has(pretalxEvent)) return;

  const timer = setTimeout(async () => {
    trailingSyncs.delete(pretalxEvent);
    try {
      // If the claim fails here, another instance synced after the request
      // that queued this one arrived, so the change is already picked up.
      const claim = await claimPretalxSync(pretalxEvent);
      if (claim?.claimed) {
        await syncPretalxConference({ id: claim.conferenceId, pretalxEvent });
      }
    } catch (err) {
      logger.error({ err, pretalxEvent }, "Queued Pretalx sync failed");
    }
  }, seconds * 1000);
  timer.unref();
  trailingSyncs.set(pretalxEvent, timer);
}
