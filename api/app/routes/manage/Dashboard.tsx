import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useManage } from "../../layouts/manage.tsx";
import {
  type SessionCounts,
  useConferenceStats,
} from "../../hooks/use-conference-stats.ts";
import { SortMenu } from "../../components/Manage/SortMenu.tsx";
import {
  fmtWhen,
  sessionStatus,
  useNow,
} from "../../components/Manage/time.ts";

const SORTS = [
  { label: "Most recent", value: "recent" },
  { label: "Most activity", value: "activity" },
  { label: "Least recent", value: "oldest" },
] as const;
type Sort = (typeof SORTS)[number]["value"];

const EMPTY: SessionCounts = { questions: 0, votes: 0, reactions: 0, participants: 0 };
const num = (n: number) => n.toLocaleString("en-US");
// Everything people did in a session.
const activity = (c: SessionCounts) => c.questions + c.votes + c.reactions;

/** Event-wide totals, then every session that has started with the same numbers. */
export default function Dashboard() {
  const { conferenceId, sessions } = useManage();
  const { data: stats } = useConferenceStats(conferenceId);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const now = useNow(30_000);
  const sort = (SORTS.find((s) => s.value === params.get("sort"))?.value ??
    "recent") as Sort;

  const all = useMemo(() => sessions ?? [], [sessions]);
  const rows = useMemo(() => {
    const byEvent = new Map(stats?.events.map((e) => [e.eventId, e]));
    const started = all
      .filter((s) => s.start <= now)
      .map((session) => ({ session, counts: byEvent.get(session.id) ?? EMPTY }));
    return started.sort(
      sort === "activity"
        ? (a, b) =>
          activity(b.counts) - activity(a.counts) ||
          +b.session.start - +a.session.start
        : sort === "oldest"
        ? (a, b) => +a.session.start - +b.session.start
        : (a, b) => +b.session.start - +a.session.start,
    );
  }, [all, stats, sort, now]);

  const upcoming = all.length - rows.length;
  const totals = stats?.totals;

  const open = (uid: string) =>
    navigate(`/manage/schedule?session=${encodeURIComponent(uid)}`);

  return (
    <div className="m-dash">
      <h1>Event dashboard</h1>

      <div className="m-tiles">
        <div className="m-card m-tile">
          <span className="label">Questions asked</span>
          <b className="value">{totals ? num(totals.questions) : "–"}</b>
          <span className="m-hint">across {rows.length} sessions so far</span>
        </div>
        <div className="m-card m-tile">
          <span className="label">Participants</span>
          <b className="value">{totals ? num(totals.participants) : "–"}</b>
          <span className="m-hint">people who asked or voted, counted once</span>
        </div>
        <div className="m-card m-tile">
          <span className="label">Reactions given</span>
          <b className="value">{totals ? num(totals.reactions) : "–"}</b>
          <span className="m-hint">across every session</span>
        </div>
      </div>

      <section className="m-card m-table" aria-label="Sessions">
        <div className="m-table-head">
          <div>
            <h2 style={{ fontSize: 16 }}>Sessions</h2>
            <span className="m-hint">
              {rows.length} started
              {upcoming > 0 && ` · ${upcoming} upcoming appear once they start`}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {sort === "activity" && (
              <span className="m-hint">Questions, votes and reactions combined</span>
            )}
            <SortMenu
              options={SORTS}
              value={sort}
              onChange={(value) =>
                setParams((p) => {
                  if (value === "recent") p.delete("sort");
                  else p.set("sort", value);
                  return p;
                }, { replace: true })}
            />
          </div>
        </div>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Session</th>
                <th scope="col" className="n">Questions</th>
                <th scope="col" className="n">Participants</th>
                <th scope="col" className="n">Reactions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ session, counts }) => {
                const live = sessionStatus(session, now) === "live";
                return (
                  <tr
                    key={session.uid}
                    tabIndex={0}
                    aria-label={`Open ${session.title}`}
                    onClick={() => open(session.uid)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        open(session.uid);
                      }
                    }}
                  >
                    <td>
                      <div className="title">
                        {live && <span className="m-live-dot" aria-label="Live" />}
                        <span>{session.title}</span>
                      </div>
                      <div className="meta">
                        <span className="m-stage">{session.stage}</span>
                        <span>{fmtWhen(session)}</span>
                        {live && <span style={{ color: "var(--m-live)", fontWeight: 600 }}>Live</span>}
                      </div>
                    </td>
                    <td className="n">{num(counts.questions)}</td>
                    <td className="n">{num(counts.participants)}</td>
                    <td className="n">{num(counts.reactions)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <div className="m-empty">No sessions have started yet.</div>}
        </div>
      </section>
    </div>
  );
}
