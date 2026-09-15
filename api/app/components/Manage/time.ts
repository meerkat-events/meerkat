import { useEffect, useState } from "react";
import type { Session } from "../../hooks/use-conference-events.ts";

// Session times are stored in UTC and there's no venue time zone yet, so the
// management pages show UTC throughout.
const pad = (n: number) => String(n).padStart(2, "0");
const MINUTE = 60_000;

export const fmtTime = (d: Date) =>
  `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Mon 14", or "Mon 14 Sep" when `long`. */
export const fmtDay = (d: Date, long = false) =>
  `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()}${long ? ` ${MONTHS[d.getUTCMonth()]}` : ""}`;

/** UTC calendar day, e.g. "2026-09-14". */
export const dayKey = (d: Date) => d.toISOString().slice(0, 10);

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
  `Asked ${fmtDay(d, true)}, ${fmtTime(d)}:${pad(d.getUTCSeconds())} UTC`;

/**
 * Testing aid: `?now=2026-09-14T15:30Z` on any management page pretends it is
 * that moment, so a schedule that isn't running today can still be walked
 * through. It only shifts what the pages display, never what is stored, and
 * sticks (per browser tab) until reset. `clockOffset()` is the shift in ms.
 */
const MOCK_KEY = "meerkat-manage-mock-now";

function readOffset(): number {
  if (typeof globalThis.location === "undefined") return 0;
  const param = new URLSearchParams(globalThis.location.search).get("now");
  if (param) {
    const at = new Date(/[zZ+]|\d{2}:\d{2}$/.test(param) ? param : `${param}Z`);
    if (!isNaN(at.getTime())) {
      sessionStorage.setItem(MOCK_KEY, String(at.getTime() - Date.now()));
    } else if (param === "off") {
      sessionStorage.removeItem(MOCK_KEY);
    }
  }
  return Number(sessionStorage.getItem(MOCK_KEY) ?? 0);
}

export const clockOffset = () => {
  try {
    return readOffset();
  } catch {
    return 0; // storage blocked
  }
};

export const isMockClock = () => clockOffset() !== 0;

export const clearMockClock = () => {
  try {
    sessionStorage.removeItem(MOCK_KEY);
  } catch { /* ignore */ }
};

/** The current time (shifted when a mock clock is set), re-rendering every `intervalMs`. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date(Date.now() + clockOffset()));
  useEffect(() => {
    const id = setInterval(
      () => setNow(new Date(Date.now() + clockOffset())),
      intervalMs,
    );
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
