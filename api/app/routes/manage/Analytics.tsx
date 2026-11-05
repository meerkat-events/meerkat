import { useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { useManage } from "../../layouts/manage.tsx";
import {
  type SessionCounts,
  useConferenceStats,
} from "../../hooks/use-conference-stats.ts";
import { BarList } from "../../components/Manage/BarList.tsx";
import { ALL_DAYS, DayFilter, useDayFilter } from "../../components/Manage/DayFilter.tsx";
import { SortMenu } from "../../components/Manage/SortMenu.tsx";
import { useConferencePath } from "../../components/Manage/use-conference-path.ts";
import { useRememberedChoice } from "../../components/Manage/use-remembered-choice.ts";
import {
  fmtDay,
  fmtWhen,
  sessionStatus,
  startOfDay,
  useNow,
} from "../../components/Manage/time.ts";
import { REACTION_GLYPHS, REACTION_LABELS, type ReactionEmoji } from "../../../reactions.ts";
import type { Route } from "./+types/Analytics.ts";

export const meta: Route.MetaFunction = () => [
  { title: "Analytics · Meerkat Management" },
];

const RANKS = [
  { label: "Most activity", value: "activity" },
  { label: "Most questions", value: "questions" },
  { label: "Most participants", value: "participants" },
  { label: "Most reactions", value: "reactions" },
] as const;

const TOP = 10;

const num = (n: number) => n.toLocaleString("en-US");
// A session opens in its panel on the schedule.
const sessionPath = (uid: string) => `/manage/schedule?session=${encodeURIComponent(uid)}`;
// Everything people did in a session.
const activity = (c: SessionCounts) => c.questions + c.votes + c.reactions;
// The heart is an SVG on the Q&A page; a chart label needs a character.
const glyph = (emoji: ReactionEmoji) => emoji === "heart" ? "❤️" : REACTION_GLYPHS[emoji];

/**
 * What attendees did, on one day of the conference (today by default) or on
 * all of them: totals, reactions by emoji, supervotes, the ten busiest
 * sessions, and the ten people with the most points.
 */
export default function Analytics() {
  const { conferenceId, sessions, openPerson } = useManage();
  const now = useNow(30_000);
  // Today while the conference runs, else every day.
  const { days, today, day, setDay, window } = useDayFilter(
    sessions,
    now,
    (days, today) => (days.includes(today) ? today : ALL_DAYS),
  );
  // Wait for the sessions, which decide the default day, so the page fetches once.
  const { data: stats } = useConferenceStats(sessions ? conferenceId : undefined, window);
  const navigate = useNavigate();
  const conferencePath = useConferencePath();
  const [rank, setRank] = useRememberedChoice("rank", RANKS.map((r) => r.value), "activity", "meerkat:manage-rank");

  const topSessions = useMemo(() => {
    const byId = new Map((sessions ?? []).map((s) => [s.id, s]));
    const score = (c: SessionCounts) => (rank === "activity" ? activity(c) : c[rank]);
    return (stats?.events ?? [])
      .flatMap((counts) => {
        const session = byId.get(counts.eventId);
        return session && score(counts) > 0 ? [{ session, counts }] : [];
      })
      .sort((a, b) => score(b.counts) - score(a.counts) || +b.session.start - +a.session.start)
      .slice(0, TOP);
  }, [sessions, stats, rank]);

  const totals = stats?.totals;
  const reactions = stats?.reactions ?? [];
  const supervotes = stats?.supervotes;
  const contributors = stats?.topContributors ?? [];
  const scope = day === ALL_DAYS ? "across every day" : `on ${fmtDay(startOfDay(day), true)}`;
  // Points add up over the whole conference, so they don't belong to one day.
  const showContributors = day === ALL_DAYS;

  return (
    <div className="m-dash">
      <DayFilter days={days} today={today} value={day} onChange={setDay} />

      <div className="m-tiles">
        <div className="m-card m-tile">
          <span className="label">Questions asked</span>
          <b className="value">{totals ? num(totals.questions) : "–"}</b>
          <span className="m-hint">{scope}</span>
        </div>
        <div className="m-card m-tile">
          <span className="label">Participants</span>
          <b className="value">{totals ? num(totals.participants) : "–"}</b>
          <span className="m-hint">people who asked or voted, counted once</span>
        </div>
        <div className="m-card m-tile">
          <span className="label">Votes cast</span>
          <b className="value">{totals ? num(totals.votes) : "–"}</b>
          <span className="m-hint">a supervote counts as one</span>
        </div>
      </div>

      <div className="m-analytics-grid">
        <section className="m-card m-analytics-card" aria-labelledby="reactions-heading">
          <div>
            <h2 id="reactions-heading">Reactions</h2>
            <span className="m-hint">
              {totals ? `${num(totals.reactions)} sent ${scope}` : "–"}
            </span>
          </div>
          <BarList
            title="By emoji"
            unit="reactions"
            items={reactions.map(({ emoji, count }) => ({
              label: `${glyph(emoji)} ${REACTION_LABELS[emoji]}`,
              value: count,
            }))}
          />
        </section>

        <section className="m-card m-analytics-card" aria-labelledby="supervotes-heading">
          <div>
            <h2 id="supervotes-heading">Supervotes</h2>
            <span className="m-hint">
              Each one weighs as much as three votes, {scope}
            </span>
          </div>
          <div className="m-tiles m-tiles-2">
            <div className="m-tile">
              <span className="label">Received</span>
              <b className="value">{supervotes ? num(supervotes.received) : "–"}</b>
              <span className="m-hint">earned when someone's question was picked</span>
            </div>
            <div className="m-tile">
              <span className="label">Given</span>
              <b className="value">{supervotes ? num(supervotes.given) : "–"}</b>
              <span className="m-hint">spent on questions</span>
            </div>
          </div>
        </section>
      </div>

      <div className={showContributors ? "m-analytics-grid" : undefined}>
        <section className="m-card m-table" aria-label={`Top ${TOP} sessions`}>
          <div className="m-table-head">
            <div>
              <h2 style={{ fontSize: 16 }}>Top {TOP} sessions</h2>
              <span className="m-hint">
                {rank === "activity" ? "Questions, votes and reactions combined" : "Busiest first"}
              </span>
            </div>
            <SortMenu options={RANKS} value={rank} onChange={setRank} />
          </div>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col" className="n">#</th>
                  <th scope="col">Session</th>
                  <th scope="col" className="n">Questions</th>
                  <th scope="col" className="n">Votes</th>
                  <th scope="col" className="n">Participants</th>
                  <th scope="col" className="n">Reactions</th>
                </tr>
              </thead>
              <tbody>
                {topSessions.map(({ session, counts }, index) => {
                  const live = sessionStatus(session, now) === "live";
                  return (
                    <tr
                      key={session.uid}
                      onClick={(ev) => {
                        // The title link handles its own clicks.
                        if ((ev.target as HTMLElement).closest("a")) return;
                        navigate(conferencePath(sessionPath(session.uid)));
                      }}
                    >
                      <td className="n rank">{index + 1}</td>
                      <td>
                        <div className="title">
                          {live && <span className="m-live-dot" aria-hidden="true" />}
                          <Link to={conferencePath(sessionPath(session.uid))}>{session.title}</Link>
                        </div>
                        <div className="meta">
                          <span className="m-stage">{session.stage}</span>
                          <span>{fmtWhen(session)}</span>
                          {live && <span style={{ color: "var(--m-live)", fontWeight: 600 }}>Live</span>}
                        </div>
                      </td>
                      <td className="n">{num(counts.questions)}</td>
                      <td className="n">{num(counts.votes)}</td>
                      <td className="n">{num(counts.participants)}</td>
                      <td className="n">{num(counts.reactions)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {stats && topSessions.length === 0 && (
              <div className="m-empty">No activity {scope} yet.</div>
            )}
          </div>
        </section>

        {showContributors && (
          <section className="m-card m-table" aria-label={`Top ${TOP} contributors`}>
            <div className="m-table-head">
              <div>
                <h2 style={{ fontSize: 16 }}>Top {TOP} contributors</h2>
                <span className="m-hint">
                  Points across the whole conference: 5 per question picked, 1 per vote received
                </span>
              </div>
            </div>
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col" className="n">#</th>
                    <th scope="col">Name</th>
                    <th scope="col" className="n">Points</th>
                    <th scope="col" className="n">Picked</th>
                    <th scope="col" className="n">Votes received</th>
                  </tr>
                </thead>
                <tbody>
                  {contributors.map((person, index) => (
                    <tr key={person.userId} onClick={() => openPerson(person.userId)}>
                      <td className="n rank">{index + 1}</td>
                      <td>
                        <div className="title">
                          <button
                            type="button"
                            className="m-person-link"
                            title="See their questions and sessions"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              openPerson(person.userId);
                            }}
                          >
                            {person.name}
                          </button>
                        </div>
                      </td>
                      <td className="n">{num(person.points)}</td>
                      <td className="n">{num(person.picked)}</td>
                      <td className="n">{num(person.votesReceived)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {stats && contributors.length === 0 && (
                <div className="m-empty">Nobody has points yet.</div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
