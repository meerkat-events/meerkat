import { type Filter, FILTERS, matchesFilter, type ModeratedQuestion } from "./question-state.ts";

/** All / Answered / Hidden / Auto-hidden / Review, each with how many questions it matches. */
export function FilterChips(
  { questions, value, onChange }: {
    questions: ModeratedQuestion[];
    value: Filter;
    onChange: (filter: Filter) => void;
  },
) {
  return (
    <div className="m-filter" role="group" aria-label="Show">
      {FILTERS.map(({ value: v, label }) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
        >
          {label}
          <span className="count">{questions.filter((q) => matchesFilter(q, v)).length}</span>
        </button>
      ))}
    </div>
  );
}
