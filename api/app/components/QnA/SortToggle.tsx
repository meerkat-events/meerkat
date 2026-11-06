import { SegmentGroup } from "@chakra-ui/react";
import type { QuestionSort } from "../../hooks/use-question-sort.ts";
import { tapTargetStyles } from "../../theme/index.ts";

const sortOptions: { label: string; value: QuestionSort }[] = [
  { label: "Newest", value: "newest" },
  { label: "Popular", value: "popular" },
];

const toQuestionSort = (value: string | null): QuestionSort | undefined =>
  sortOptions.find((option) => option.value === value)?.value;

interface SortToggleProps {
  /**
   * Undefined until the remembered sort is known (after hydration): nothing
   * is selected meanwhile, so the control doesn't jump from the default to
   * the remembered sort on load.
   */
  value: QuestionSort | undefined;
  onChange: (next: QuestionSort) => void;
}

/**
 * The Q&A page's sort, as a compact two-option segmented control: both
 * sorts are visible, the current one is the raised segment, and one tap
 * picks the other. Each segment keeps the minimum tap target.
 */
export function SortToggle({ value, onChange }: SortToggleProps) {
  return (
    <SegmentGroup.Root
      size="xs"
      value={value ?? null}
      onValueChange={(details) => {
        const next = toQuestionSort(details.value);
        if (next) onChange(next);
      }}
      aria-label="Sort questions"
      css={{
        "--segment-radius": "radii.full",
        "--segment-indicator-bg": "colors.segment.indicator",
      }}
      // Brand-tinted instead of Chakra's gray track and inset shadow
      bg="segment.track"
      boxShadow="none"
      padding="0.5"
      flexShrink="0"
    >
      <SegmentGroup.Indicator />
      {sortOptions.map((option) => (
        <SegmentGroup.Item
          key={option.value}
          value={option.value}
          paddingInline="3"
          fontWeight="medium"
          whiteSpace="nowrap"
          color="fg.muted"
          cursor="pointer"
          _checked={{ color: "accent.text" }}
          // Chakra draws a divider between segments in `_before`; with two
          // segments the raised one says enough.
          _before={{ display: "none" }}
          _after={tapTargetStyles._before}
        >
          <SegmentGroup.ItemText>{option.label}</SegmentGroup.ItemText>
          <SegmentGroup.ItemHiddenInput />
        </SegmentGroup.Item>
      ))}
    </SegmentGroup.Root>
  );
}
