import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { useManage } from "../../layouts/manage.tsx";
import { useConferenceQuestions } from "../../hooks/use-conference-questions.ts";
import { QuestionTable } from "../../components/Manage/QuestionTable.tsx";
import { FilterChips } from "../../components/Manage/FilterChips.tsx";
import {
  FILTERS,
  matchesFilter,
  SORTS,
  sortQuestions,
} from "../../components/Manage/question-state.ts";
import { SortMenu } from "../../components/Manage/SortMenu.tsx";
import { fmtDay, useNow } from "../../components/Manage/time.ts";
import { useUrlChoice } from "../../components/Manage/use-url-choice.ts";
import type { Route } from "./+types/Feed.ts";

export const meta: Route.MetaFunction = () => [
  { title: "Live question feed · Meerkat Management" },
];

/**
 * Every question from every live session, newest first, so organizers can
 * moderate several stages at once. `?session=<uid>` narrows it to one talk.
 */
export default function Feed() {
  const { conferenceId, sessions, openPerson } = useManage();
  const [params, setParams] = useSearchParams();
  const now = useNow(30_000);
  const { data: questions, mutate, isLoading } = useConferenceQuestions(
    conferenceId,
    { live: true },
  );

  const [sort, setSort] = useUrlChoice("sort", SORTS.map((s) => s.value), "newest");
  const [filter, setFilter] = useUrlChoice("show", FILTERS.map((f) => f.value), "all");
  const liveSessions = useMemo(
    () =>
      (sessions ?? []).filter((s) => s.live).sort((a, b) =>
        a.stage.localeCompare(b.stage)
      ),
    [sessions],
  );
  const scope = liveSessions.find((s) => s.uid === params.get("session"));

  const counts = useMemo(() => {
    const byEvent = new Map<number, number>();
    questions?.forEach((q) =>
      byEvent.set(q.eventId, (byEvent.get(q.eventId) ?? 0) + 1)
    );
    return byEvent;
  }, [questions]);

  const inScope = useMemo(
    () => (questions ?? []).filter((q) => !scope || q.eventId === scope.id),
    [questions, scope],
  );

  const shown = useMemo(
    () => sortQuestions(inScope.filter((q) => matchesFilter(q, filter)), sort),
    [inScope, filter, sort],
  );

  const setParam = (key: string, value: string | null) =>
    setParams((p) => {
      if (value) p.set(key, value);
      else p.delete(key);
      return p;
    }, { replace: true });

  return (
    <div className="m-feed">
      <nav className="m-card m-rail" aria-label="Filter by live session">
        <button
          type="button"
          className="m-rail-item"
          aria-current={!scope}
          onClick={() => setParam("session", null)}
        >
          <span className="label">
            <span className="title" style={{ fontWeight: 600 }}>
              All live sessions
            </span>
          </span>
          <span className="count">{questions?.length ?? 0}</span>
        </button>
        {liveSessions.length > 0 && (
          <div className="m-rail-group">
            {liveSessions.map((session) => (
              <button
                key={session.uid}
                type="button"
                className="m-rail-item"
                aria-current={scope?.uid === session.uid}
                onClick={() => setParam("session", session.uid)}
              >
                <span className="m-live-dot" aria-hidden="true" />
                <span className="label">
                  <span className="m-stage">{session.stage}</span>
                  <span className="title">{session.title}</span>
                </span>
                <span className="count">{counts.get(session.id) ?? 0}</span>
              </button>
            ))}
          </div>
        )}
      </nav>

      <section className="m-card m-stream" aria-label="Questions">
        <div className="m-stream-head">
          <div style={{ minWidth: 0 }}>
            <div className="m-eyebrow">
              {scope ? `${scope.stage} · live now` : `Live now · ${fmtDay(now, true)}`}
            </div>
            <h2>{scope ? scope.title : "All live sessions"}</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <FilterChips
              questions={inScope}
              value={filter}
              onChange={setFilter}
            />
            <SortMenu
              options={SORTS}
              value={sort}
              onChange={setSort}
            />
          </div>
        </div>
        <div className="m-stream-scroll">
          {shown.length
            ? (
              <QuestionTable
                questions={shown}
                now={now}
                showSession={!scope}
                onSession={(uid) => setParam("session", uid)}
                onPerson={openPerson}
                refresh={() => mutate()}
              />
            )
            : (
              <div className="m-empty">
                {isLoading
                  ? "Loading questions…"
                  : liveSessions.length
                  ? "No questions yet."
                  : "Nothing is live right now."}
              </div>
            )}
        </div>
      </section>
    </div>
  );
}
