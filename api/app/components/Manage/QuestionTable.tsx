import { QuestionActions } from "./QuestionActions.tsx";
import {
  type ModeratedQuestion,
  questionStates,
  reasonText,
  relevanceLevel,
} from "./question-state.ts";
import { RelevanceInfo } from "./RelevanceInfo.tsx";
import { askedAt, askedTitle } from "./time.ts";

type Row = ModeratedQuestion & {
  event?: { uid: string; title: string; stage: string };
};

/**
 * Questions as a dense table: one row each, the question itself in full.
 * Used by the live feed (many sessions) and the session panel (one session).
 */
export function QuestionTable(
  { questions, now, showSession, showPerson = true, rowOpensSession = false, onSession, onPerson, refresh }: {
    questions: Row[];
    now: Date;
    showSession: boolean;
    /** Off when every row is the same person (their history). */
    showPerson?: boolean;
    /**
     * A click anywhere on a row also does `onSession` for its session (someone's
     * history). Clicks on the row's own buttons keep their meaning, and the
     * session name stays the button keyboard users reach.
     */
    rowOpensSession?: boolean;
    onSession?: (uid: string) => void;
    onPerson: (userId: string) => void;
    refresh: () => void;
  },
) {
  const onRowClick = (q: Row) => (ev: React.MouseEvent) => {
    if ((ev.target as HTMLElement).closest("button, a, [role=menu]")) return;
    if (q.event) onSession?.(q.event.uid);
  };
  return (
    <table className="m-qtable">
      <thead>
        <tr>
          <th scope="col" className="when">Asked</th>
          {showSession && <th scope="col" className="session">Session</th>}
          <th scope="col" className="question">Question</th>
          <th scope="col" className="status">Status</th>
          {showPerson && <th scope="col" className="who">Asked by</th>}
          <th scope="col" className="relevance">
            <span className="m-th-info">
              Relevance
              <RelevanceInfo />
            </span>
          </th>
          <th scope="col" className="n">Votes</th>
          <th scope="col" className="actions">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {questions.map((q) => {
          const createdAt = new Date(q.createdAt);
          const states = questionStates(q);
          const dimmed = states.includes("answered") || states.includes("hidden") ||
            states.includes("autoHidden");
          return (
            <tr
              key={q.uid}
              className={[dimmed && "answered", rowOpensSession && "clickable"]
                .filter(Boolean)
                .join(" ")}
              onClick={rowOpensSession ? onRowClick(q) : undefined}
            >
              <td className="when">
                <time dateTime={createdAt.toISOString()} title={askedTitle(createdAt)}>
                  {askedAt(createdAt, now)}
                </time>
              </td>
              {showSession && (
                <td className="session">
                  {q.event && (
                    <button
                      type="button"
                      onClick={() => onSession?.(q.event!.uid)}
                      title={q.event.title}
                    >
                      <span className="m-stage">{q.event.stage}</span>
                      <span className="title">{q.event.title}</span>
                    </button>
                  )}
                </td>
              )}
              <td className="question">{q.question}</td>
              <td className="status">
                <span className="tags">
                  {states.includes("autoHidden") && (
                    <span className="tag flagged">Auto-hidden</span>
                  )}
                  {states.includes("review") && <span className="tag review">Review</span>}
                  {states.includes("hidden") && <span className="tag">Hidden</span>}
                  {states.includes("answering") && (
                    <span className="tag answering">Answering</span>
                  )}
                  {states.includes("answered") && <span className="tag">Answered</span>}
                </span>
                {(states.includes("autoHidden") || states.includes("review")) &&
                  reasonText(q.moderation) && (
                  <span className="reason">{reasonText(q.moderation)}</span>
                )}
              </td>
              {showPerson && (
                <td className="who">
                  {q.user
                    ? (
                      <button
                        type="button"
                        className="m-person-link"
                        onClick={() => onPerson(q.user!.id)}
                        title="See their questions and sessions"
                      >
                        {q.user.name ?? q.user.id}
                      </button>
                    )
                    : "Unknown"}
                </td>
              )}
              <td className="relevance">
                {q.moderation?.relevance != null
                  ? (
                    <>
                      <span className="score">{q.moderation.relevance.toFixed(1)}</span>
                      <span className="level">{relevanceLevel(q.moderation.relevance)}</span>
                    </>
                  )
                  : <span className="level">Not scored</span>}
              </td>
              <td className="n">{q.votes}</td>
              <td className="actions">
                <QuestionActions question={q} refresh={refresh} onPerson={onPerson} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
