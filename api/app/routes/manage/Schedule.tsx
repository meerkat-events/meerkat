import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { useManage } from "../../layouts/manage.tsx";
import { useConferenceEvents } from "../../hooks/use-conference-events.ts";
import { useConferenceStats } from "../../hooks/use-conference-stats.ts";
import { DayFilter, sessionDays } from "../../components/Manage/DayFilter.tsx";
import { Timeline } from "../../components/Manage/Timeline.tsx";
import { SessionPanel } from "../../components/Manage/SessionPanel.tsx";
import { dayKey, endOfDay, startOfDay, useNow } from "../../components/Manage/time.ts";
import type { Route } from "./+types/Schedule.ts";

export const meta: Route.MetaFunction = () => [
  { title: "Schedule · Meerkat Management" },
];

/**
 * The open session (?session=) and what its dialog shows: tab, filter, sort
 * and QR code target (SessionPanel). They go together.
 */
function clearSession(p: URLSearchParams) {
  for (const key of ["session", "sessionTab", "show", "sort", "qr"]) p.delete(key);
}

/**
 * The conference day by day, a row per stage. `?day=YYYY-MM-DD` picks the day
 * and `?session=<uid>` opens a session's panel (search and the analytics link
 * here), with `?sessionTab=`, `?show=`, `?sort=` and `?qr=` for what it shows.
 */
export default function Schedule() {
  const { conferenceId, sessions: allSessions } = useManage();
  const { mutate: refreshSessions } = useConferenceEvents(conferenceId);
  const { data: stats } = useConferenceStats(conferenceId);
  const [params, setParams] = useSearchParams();
  const now = useNow(30_000);
  const sessions = useMemo(() => allSessions ?? [], [allSessions]);

  const days = useMemo(() => sessionDays(sessions), [sessions]);
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
  const dayStart = day ? startOfDay(day) : undefined;
  const dayEnd = day ? endOfDay(day) : undefined;
  const daySessions = dayStart && dayEnd
    ? sessions.filter((s) => s.start < dayEnd && s.end > dayStart)
    : [];

  const setDay = (d: string) =>
    setParams((p) => {
      p.set("day", d);
      clearSession(p);
      return p;
    }, { replace: true });
  const select = (uid: string | undefined) =>
    setParams((p) => {
      clearSession(p);
      if (uid) p.set("session", uid);
      if (day) p.set("day", day);
      return p;
    }, { replace: true });
  // From a session's questions to someone's history, in one URL change.
  const openPersonInstead = (userId: string) =>
    setParams((p) => {
      clearSession(p);
      p.set("person", userId);
      p.delete("personTab");
      return p;
    }, { replace: true });

  if (!sessions.length) {
    return <div className="m-empty">{allSessions ? "No sessions yet." : "Loading the schedule…"}</div>;
  }

  return (
    <div className="m-schedule">
      <DayFilter days={days} today={today} value={day} onChange={setDay} allDays={false} />
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
      {/* One dialog at a time, even if a link names a session and a person. */}
      {selected && !params.get("person") && (
        <SessionPanel
          key={selected.uid}
          session={selected}
          counts={counts.get(selected.id)}
          onClose={() => select(undefined)}
          onChanged={() => refreshSessions()}
          onPerson={openPersonInstead}
        />
      )}
    </div>
  );
}
