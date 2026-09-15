import { QuestionActions } from "./QuestionActions.tsx";
import { type ModeratedQuestion, questionStates } from "./question-state.ts";
import { askedAt, askedTitle } from "./time.ts";

type Row = ModeratedQuestion & {
  event?: { uid: string; title: string; stage: string };
};

/**
 * Questions as a dense table: one row each, the question itself in full.
 * Used by the live feed (many sessions) and the session panel (one session).
 */
export function QuestionTable(
  { questions, now, showSession, showPerson = true, compact, onSession, onPerson, refresh }: {
    questions: Row[];
    now: Date;
    showSession: boolean;
    /** Off when every row is the same person (their history). */
    showPerson?: boolean;
    /** Stacks each row (question, then its details) for narrow columns. */
    compact?: boolean;
    onSession?: (uid: string) => void;
    onPerson: (userId: string) => void;
    refresh: () => void;
  },
) {
  return (
    <table className={`m-qtable ${compact ? "compact" : ""}`}>
      <thead>
        <tr>
          <th scope="col" className="when">Asked</th>
          {showSession && <th scope="col" className="session">Session</th>}
          <th scope="col" className="question">Question</th>
          <th scope="col" className="status">Status</th>
          {showPerson && <th scope="col" className="who">Asked by</th>}
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
          const dimmed = states.includes("answered") || states.includes("hidden");
          return (
            <tr key={q.uid} className={dimmed ? "answered" : ""}>
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
                      title={`Show only ${q.event.title}`}
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
                  {states.includes("spam") && (
                    <span className="tag spam" title={q.flagReason ?? "Flagged as spam"}>
                      Spam
                    </span>
                  )}
                  {states.includes("hidden") && <span className="tag">Hidden</span>}
                  {states.includes("answering") && (
                    <span className="tag answering">Answering</span>
                  )}
                  {states.includes("answered") && <span className="tag">Answered</span>}
                </span>
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
              <td className="n">{q.votes}</td>
              <td className="actions">
                <QuestionActions question={q} refresh={refresh} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
