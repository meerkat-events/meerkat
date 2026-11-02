import { useEffect, useState } from "react";
import type { Session } from "../../hooks/use-conference-events.ts";

// Session times are stored in UTC; the management pages show them in the
// browser's time zone. The pages render only in the browser (clientLoader), so
// the server's time zone never shows. Safari is the most common browser on
// these pages and has no Temporal, so they use Date and Intl only.
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// British English: 24-hour clock and "Mon 14 Sept", in the browser's time zone.
const LOCALE = "en-GB";
const TIME = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const DAY_SHORT = new Intl.DateTimeFormat(LOCALE, { weekday: "short", day: "numeric" });
const DAY_LONG = new Intl.DateTimeFormat(LOCALE, { weekday: "short", day: "numeric", month: "short" });
const ZONE = new Intl.DateTimeFormat(LOCALE, { timeZoneName: "short" });
const ASKED = new Intl.DateTimeFormat(LOCALE, {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZoneName: "short",
});
const DURATION = new Intl.DurationFormat(LOCALE, { style: "narrow" });
const RELATIVE = new Intl.RelativeTimeFormat(LOCALE, { style: "narrow" });

/** "14:05" */
export const fmtTime = (d: Date) => TIME.format(d);

/** "Mon 14", or "Mon 14 Sept" when `long`. */
export const fmtDay = (d: Date, long = false) => (long ? DAY_LONG : DAY_SHORT).format(d);

const pad = (n: number, width: number) => String(n).padStart(width, "0");

/** Local calendar day, e.g. "2026-09-14". */
export const dayKey = (d: Date) =>
  `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`;

/** Local midnight `daysLater` calendar days after the start of a `dayKey` day. */
const localMidnight = (key: string, daysLater: number) => {
  const [year = 0, month = 1, day = 1] = key.split("-").map(Number);
  // The Date constructor reads its parts in local time and carries a day past
  // the end of the month into the next month.
  return new Date(year, month - 1, day + daysLater);
};

/** Local midnight at the start of a `dayKey` day. */
export const startOfDay = (key: string) => localMidnight(key, 0);

/** Local midnight at the end of a `dayKey` day: 23 or 25 hours later on a DST change. */
export const endOfDay = (key: string) => localMidnight(key, 1);

/** The browser's time zone at `d`, e.g. "CEST", "GMT-7" or "GMT+5:30". */
export const zoneName = (d: Date) =>
  ZONE.formatToParts(d).find((part) => part.type === "timeZoneName")?.value ?? "";

/** Whether a session ends on the day it starts; ending at midnight counts. */
const endsSameDay = ({ start, end }: { start: Date; end: Date }) =>
  dayKey(start) === dayKey(new Date(end.getTime() - 1));

/** "14:00–15:30", or "Mon 14, 18:55 – Wed 16, 18:55" when it crosses midnight. */
export const fmtRange = (session: { start: Date; end: Date }) =>
  endsSameDay(session)
    ? TIME.formatRange(session.start, session.end)
    : `${fmtDay(session.start)}, ${fmtTime(session.start)} – ${fmtDay(session.end)}, ${fmtTime(session.end)}`;

/** Day and time of a session: "Mon 14 · 14:00–15:30", or the full range when it crosses midnight. */
export const fmtWhen = (session: { start: Date; end: Date }) =>
  endsSameDay(session)
    ? `${fmtDay(session.start)} · ${fmtRange(session)}`
    : fmtRange(session);

/** "5m", "1h 30m", or "2d 3h" (no minutes) beyond a day. */
export const fmtDuration = (ms: number) => {
  const positive = Math.max(0, ms);
  const minutes = ms > DAY
    ? Math.floor(positive / HOUR) * 60
    : Math.round(positive / MINUTE);
  const duration = {
    days: Math.floor(minutes / (24 * 60)),
    hours: Math.floor(minutes / 60) % 24,
    minutes: minutes % 60,
  };
  // DurationFormat prints nothing for a zero duration.
  return minutes === 0 ? "0m" : DURATION.format(duration);
};

/** When a question was asked: relative within the hour, then clock time, then day + time. */
export const askedAt = (d: Date, now: Date) => {
  const m = Math.floor((now.getTime() - d.getTime()) / MINUTE);
  if (m < 1) return "just now";
  if (m < 60) return RELATIVE.format(-m, "minute");
  return dayKey(d) === dayKey(now) ? fmtTime(d) : `${fmtDay(d)}, ${fmtTime(d)}`;
};

export const askedTitle = (d: Date) => `Asked ${ASKED.format(d)}`;

/** The current time, re-rendering every `intervalMs`. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export type SessionStatus = "live" | "upcoming" | "ended" | "now";

/** "live" follows the live flag, which is what the stage screen shows. */
export function sessionStatus(session: Session, now: Date): SessionStatus {
  if (session.live) return "live";
  if (now < session.start) return "upcoming";
  if (now >= session.end) return "ended";
  return "now";
}
