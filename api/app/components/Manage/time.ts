import { useEffect, useState } from "react";
import type { Session } from "../../hooks/use-conference-events.ts";

// Session times are stored in UTC; the management pages show them in the
// browser's time zone. The pages render only in the browser (clientLoader), so
// the server's time zone never shows.
const pad = (n: number) => String(n).padStart(2, "0");
const MINUTE = 60_000;

export const fmtTime = (d: Date) =>
  `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Mon 14", or "Mon 14 Sep" when `long`. */
export const fmtDay = (d: Date, long = false) =>
  `${WEEKDAYS[d.getDay()]} ${d.getDate()}${long ? ` ${MONTHS[d.getMonth()]}` : ""}`;

/** Local calendar day, e.g. "2026-09-14". */
export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Local midnight at the start of a `dayKey` day. */
export const startOfDay = (key: string) => {
  const [year = 0, month = 1, day = 1] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
};

/** Local midnight at the end of a `dayKey` day: 23 or 25 hours later on a DST change. */
export const endOfDay = (key: string) => {
  const start = startOfDay(key);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
};

/** The browser's time zone at `d`, e.g. "PST", "GMT+2" or "GMT+5:30". */
export const zoneName = (d: Date) =>
  new Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
    .formatToParts(d)
    .find((part) => part.type === "timeZoneName")?.value ?? "";

/** "14:00–15:30", or "Mon 14, 18:55 – Wed 16, 18:55" when it crosses midnight. */
export const fmtRange = ({ start, end }: { start: Date; end: Date }) =>
  dayKey(start) === dayKey(new Date(end.getTime() - 1))
    ? `${fmtTime(start)}–${fmtTime(end)}`
    : `${fmtDay(start)}, ${fmtTime(start)} – ${fmtDay(end)}, ${fmtTime(end)}`;

/** Day and time of a session: "Mon 14 · 14:00–15:30", or the full range when it crosses midnight. */
export const fmtWhen = (session: { start: Date; end: Date }) =>
  dayKey(session.start) === dayKey(new Date(session.end.getTime() - 1))
    ? `${fmtDay(session.start)} · ${fmtRange(session)}`
    : fmtRange(session);

export const fmtDuration = (ms: number) => {
  const m = Math.max(0, Math.round(ms / MINUTE));
  if (m > 24 * 60) {
    const hours = Math.floor(m / 60) % 24;
    return `${Math.floor(m / (24 * 60))}d${hours ? ` ${hours}h` : ""}`;
  }
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`;
};

/** When a question was asked: relative within the hour, then clock time, then day + time. */
export const askedAt = (d: Date, now: Date) => {
  const m = Math.floor((now.getTime() - d.getTime()) / MINUTE);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  return dayKey(d) === dayKey(now) ? fmtTime(d) : `${fmtDay(d)}, ${fmtTime(d)}`;
};

export const askedTitle = (d: Date) =>
  `Asked ${fmtDay(d, true)}, ${fmtTime(d)}:${pad(d.getSeconds())} ${zoneName(d)}`;

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
