import { useMemo } from "react";
import { FilterChips } from "./FilterChips.tsx";
import {
  type Filter,
  FILTERS,
  matchesFilter,
  type ModeratedQuestion,
  type Sort,
  SORT_STORAGE_KEY,
  SORTS,
  sortQuestions,
} from "./question-state.ts";
import { SortMenu } from "./SortMenu.tsx";
import { useRememberedChoice } from "./use-remembered-choice.ts";
import { useUrlChoice } from "./use-url-choice.ts";

/** Which of a list's questions are shown, and in what order. */
export type QuestionView<T extends ModeratedQuestion> = {
  /** Every question, for the filters' counts. */
  questions: T[];
  /** Those the filter lets through, sorted. */
  shown: T[];
  filter: Filter;
  setFilter: (filter: Filter) => void;
  sort: Sort;
  setSort: (sort: Sort) => void;
};

/**
 * The filter (`?show=`) and sort (`?sort=`, remembered on the device) of a
 * question list, the same for the live feed and every session.
 */
export function useQuestionView<T extends ModeratedQuestion>(questions: T[]): QuestionView<T> {
  const [sort, setSort] = useRememberedChoice("sort", SORTS.map((s) => s.value), "newest", SORT_STORAGE_KEY);
  const [filter, setFilter] = useUrlChoice("show", FILTERS.map((f) => f.value), "all");
  const shown = useMemo(
    () => sortQuestions(questions.filter((q) => matchesFilter(q, filter)), sort),
    [questions, filter, sort],
  );
  return { questions, shown, filter, setFilter, sort, setSort };
}

/** The filter chips and sort menu for a `useQuestionView`. */
export function QuestionToolbar<T extends ModeratedQuestion>({ view }: { view: QuestionView<T> }) {
  return (
    <div className="m-toolbar">
      <FilterChips questions={view.questions} value={view.filter} onChange={view.setFilter} />
      <SortMenu options={SORTS} value={view.sort} onChange={view.setSort} />
    </div>
  );
}
