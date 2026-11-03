import { useNavigate } from "react-router";
import { useManage } from "../../layouts/manage.tsx";
import { useConferenceQuestions } from "../../hooks/use-conference-questions.ts";
import { useConferenceStats } from "../../hooks/use-conference-stats.ts";
import { ALL_DAYS, DayFilter, useDayFilter } from "../../components/Manage/DayFilter.tsx";
import { ModerationOverview } from "../../components/Manage/ModerationOverview.tsx";
import { QuestionTable } from "../../components/Manage/QuestionTable.tsx";
import { useConferencePath } from "../../components/Manage/use-conference-path.ts";
import { fmtDay, startOfDay, useNow } from "../../components/Manage/time.ts";
import type { Route } from "./+types/Moderation.ts";

export const meta: Route.MetaFunction = () => [
  { title: "Moderation · Meerkat Management" },
];

/**
 * What automatic moderation did, on one day or all of them: its totals, then
 * every question it hid or marked for review (restored ones included),
 * newest first, to check and restore.
 */
export default function Moderation() {
  const { conferenceId, sessions, openPerson } = useManage();
  const now = useNow(30_000);
  const { days, today, day, setDay, window } = useDayFilter(sessions, now, () => ALL_DAYS);
  const { data: stats } = useConferenceStats(conferenceId, window);
  const { data: questions, mutate, isLoading } = useConferenceQuestions(
    conferenceId,
    { moderated: true, window },
  );
  const navigate = useNavigate();
  const conferencePath = useConferencePath();

  const scope = day === ALL_DAYS ? "every day" : fmtDay(startOfDay(day), true);

  return (
    <div className="m-dash">
      <DayFilter days={days} today={today} value={day} onChange={setDay} />

      {stats && <ModerationOverview moderation={stats.moderation} />}

      <section className="m-card m-stream" aria-labelledby="moderated-heading">
        <div className="m-stream-head">
          <div>
            <h2 id="moderated-heading" style={{ fontSize: 16 }}>Moderated questions</h2>
            <span className="m-hint">
              Hidden or marked for review, asked on {scope}, newest first
            </span>
          </div>
        </div>
        <div className="m-stream-scroll">
          {questions?.length
            ? (
              <QuestionTable
                // The API returns them newest first.
                questions={questions}
                now={now}
                showSession
                onSession={(uid) =>
                  navigate(conferencePath(`/manage/schedule?session=${encodeURIComponent(uid)}`))}
                onPerson={openPerson}
                refresh={() => mutate()}
              />
            )
            : (
              <div className="m-empty">
                {isLoading ? "Loading questions…" : "Moderation hasn't hidden or flagged any questions."}
              </div>
            )}
        </div>
      </section>
    </div>
  );
}
