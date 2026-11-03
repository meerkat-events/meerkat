import { useMemo } from "react";
import type { Session } from "../../hooks/use-conference-events.ts";
import type { TimeWindow } from "../../hooks/use-conference-stats.ts";
import { dayKey, endOfDay, fmtDay, startOfDay } from "./time.ts";
import { useUrlChoice } from "./use-url-choice.ts";

/** "All days", or one `dayKey` day. */
export const ALL_DAYS = "all";

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
  const days = useMemo(
    () => [...new Set((sessions ?? []).map((s) => dayKey(s.start)))].sort(),
    [sessions],
  );
  const today = dayKey(now);
  const [day, setDay] = useUrlChoice("day", [ALL_DAYS, ...days], fallback(days, today));
  const window = useMemo<TimeWindow | undefined>(
    () => (day === ALL_DAYS ? undefined : { from: startOfDay(day), to: endOfDay(day) }),
    [day],
  );

  return { days, today, day, setDay, window };
}

/** All days, then each day of the conference; today is marked. */
export function DayFilter(
  { days, today, value, onChange }: {
    days: string[];
    today: string;
    value: string;
    onChange: (day: string) => void;
  },
) {
  return (
    <nav className="m-days" aria-label="Event days">
      <button type="button" aria-current={value === ALL_DAYS} onClick={() => onChange(ALL_DAYS)}>
        All days
      </button>
      {days.map((d) => (
        <button key={d} type="button" aria-current={d === value} onClick={() => onChange(d)}>
          {fmtDay(startOfDay(d))}
          {d === today && <small>Today</small>}
        </button>
      ))}
    </nav>
  );
}
