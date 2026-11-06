import { useMemo } from "react";
import type { Session } from "../../hooks/use-conference-events.ts";
import type { TimeWindow } from "../../hooks/use-conference-stats.ts";
import { dayKey, endOfDay, fmtDay, startOfDay } from "./time.ts";
import { useUrlChoice } from "./use-url-choice.ts";

/** "All days", or one `dayKey` day. */
export const ALL_DAYS = "all";

/** The days the sessions start on, as sorted `dayKey`s. */
export function sessionDays(sessions: Session[] | undefined) {
  return [...new Set((sessions ?? []).map((s) => dayKey(s.start)))].sort();
}

/**
 * The day a page shows, kept in the URL (`?day=YYYY-MM-DD`, or `?day=all`
 * when the page defaults to a day): one of the conference's days, in the
 * browser's time zone, or all of them. `fallback` picks the default from the
 * days and today. Returns the window to count, undefined for all days.
 */
export function useDayFilter(
  sessions: Session[] | undefined,
  now: Date,
  fallback: (days: string[], today: string) => string,
) {
  const days = useMemo(() => sessionDays(sessions), [sessions]);
  const today = dayKey(now);
  const [day, setDay] = useUrlChoice("day", [ALL_DAYS, ...days], fallback(days, today));
  const window = useMemo<TimeWindow | undefined>(
    () => (day === ALL_DAYS ? undefined : { from: startOfDay(day), to: endOfDay(day) }),
    [day],
  );

  return { days, today, day, setDay, window };
}

/** All days (unless `allDays` is off), then each day of the conference; today is marked. */
export function DayFilter(
  { days, today, value, onChange, allDays = true }: {
    days: string[];
    today: string;
    value: string | undefined;
    onChange: (day: string) => void;
    allDays?: boolean;
  },
) {
  return (
    <nav className="m-days" aria-label="Event days">
      {allDays && (
        <button type="button" aria-current={value === ALL_DAYS} onClick={() => onChange(ALL_DAYS)}>
          All days
        </button>
      )}
      {days.map((d) => (
        <button key={d} type="button" aria-current={d === value} onClick={() => onChange(d)}>
          {fmtDay(startOfDay(d))}
          {d === today && <small>Today</small>}
        </button>
      ))}
    </nav>
  );
}
