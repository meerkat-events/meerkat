import { type Filter, FILTERS, matchesFilter, type ModeratedQuestion } from "./question-state.ts";

/**
 * All / Open / Answered / Hidden / Spam, each with how many questions it
 * matches. `exclude` drops states a list can never contain.
 */
export function FilterChips(
  { questions, value, onChange, exclude = [] }: {
    questions: ModeratedQuestion[];
    value: Filter;
    onChange: (filter: Filter) => void;
    exclude?: Filter[];
  },
) {
  return (
    <div className="m-filter" role="group" aria-label="Show">
      {FILTERS.filter(({ value: v }) => !exclude.includes(v)).map(({ value: v, label }) => (
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
