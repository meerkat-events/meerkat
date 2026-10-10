import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { useManage } from "../../layouts/manage.tsx";
import { useConferenceEvents } from "../../hooks/use-conference-events.ts";
import { useConferenceStats } from "../../hooks/use-conference-stats.ts";
import { Timeline } from "../../components/Manage/Timeline.tsx";
import { SessionPanel } from "../../components/Manage/SessionPanel.tsx";
import { dayKey, fmtDay, useNow } from "../../components/Manage/time.ts";
import type { Route } from "./+types/Schedule.ts";

export const meta: Route.MetaFunction = () => [
  { title: "Schedule · Meerkat Management" },
];

const DAY = 86_400_000;

/**
 * The conference day by day, a row per stage. `?day=YYYY-MM-DD` picks the day
 * and `?session=<uid>` opens a session's panel (search and the analytics link here).
 */
export default function Schedule() {
  const { conferenceId, sessions: allSessions, openPerson } = useManage();
  const { mutate: refreshSessions } = useConferenceEvents(conferenceId);
  const { data: stats } = useConferenceStats(conferenceId);
  const [params, setParams] = useSearchParams();
  const now = useNow(30_000);
  const sessions = useMemo(() => allSessions ?? [], [allSessions]);

  const days = useMemo(
    () => [...new Set(sessions.map((s) => dayKey(s.start)))].sort(),
    [sessions],
  );
  const stages = useMemo(
    () => [...new Set(sessions.map((s) => s.stage))].sort((a, b) => a.localeCompare(b)),
    [sessions],
  );
  const counts = useMemo(
    () => new Map(stats?.events.map((e) => [e.eventId, e])),
    [stats],
  );

  const selected = sessions.find((s) => s.uid === params.get("session"));
  const today = dayKey(now);
  const day = params.get("day") ??
    (selected ? dayKey(selected.start) : undefined) ??
    // Today, else the next day with sessions, else the last one.
    (days.includes(today) ? today : days.find((d) => d > today) ?? days.at(-1));
  const dayStart = day ? new Date(`${day}T00:00:00Z`) : undefined;
  const daySessions = dayStart
    ? sessions.filter((s) => s.start.getTime() < dayStart.getTime() + DAY && s.end > dayStart)
    : [];

  const setDay = (d: string) =>
    setParams((p) => {
      p.set("day", d);
      p.delete("session");
      return p;
    }, { replace: true });
  const select = (uid: string | undefined) =>
    setParams((p) => {
      if (uid) p.set("session", uid);
      else p.delete("session");
      if (day) p.set("day", day);
      return p;
    }, { replace: true });

  if (!sessions.length) {
    return <div className="m-empty">{allSessions ? "No sessions yet." : "Loading the schedule…"}</div>;
  }

  return (
    <div className="m-schedule">
      <div className="m-schedule-bar">
        <nav className="m-days" aria-label="Event days">
          {days.map((d) => (
            <button key={d} type="button" aria-current={d === day} onClick={() => setDay(d)}>
              {fmtDay(new Date(`${d}T00:00:00Z`))}
              {d === today && <small>Today</small>}
            </button>
          ))}
        </nav>
      </div>
      <div className="m-schedule-body">
        {dayStart && (
          <Timeline
            day={dayStart}
            sessions={daySessions}
            stages={stages.filter((stage) => daySessions.some((s) => s.stage === stage))}
            now={now}
            counts={counts}
            selectedUid={selected?.uid}
            onSelect={(s) => select(s.uid)}
          />
        )}
        {selected && (
          <SessionPanel
            key={selected.uid}
            session={selected}
            counts={counts.get(selected.id)}
            onClose={() => select(undefined)}
            onChanged={() => refreshSessions()}
            onPerson={openPerson}
          />
        )}
      </div>
    </div>
  );
}
