import { Text, VisuallyHidden } from "@chakra-ui/react";
import { useEffect, useState } from "react";

/** From this many characters left, the counter turns to the warning colour. */
const NEAR_LIMIT_REMAINING = 20;

/** Screen readers hear the count this long after the attendee stops typing. */
const ANNOUNCE_DELAY_MS = 1000;

export type QuestionLengthCounterProps = {
  /** Characters typed so far. */
  length: number;
  /** The most the question may have, shared with the API's validation. */
  maxLength: number;
  /**
   * Id of the static "Up to … characters" text, for the field's
   * `aria-describedby`.
   */
  descriptionId: string;
  /** Class of the visible count, for placing it in the caller's layout. */
  className?: string;
};

/**
 * Shows "120 / 200" under the question field once the attendee types,
 * in the warning colour near the limit and the error colour at it.
 *
 * Screen readers get a static description of the limit (through the field's
 * `aria-describedby`) and, only near the limit, a polite announcement of the
 * characters left once typing pauses, so they don't hear every keystroke.
 */
export function QuestionLengthCounter(
  { length, maxLength, descriptionId, className }: QuestionLengthCounterProps,
) {
  const remaining = maxLength - length;
  const isAtLimit = remaining <= 0;
  const isNearLimit = remaining <= NEAR_LIMIT_REMAINING;

  const announcement = useDelayedAnnouncement(
    isNearLimit ? describeRemaining(remaining) : "",
  );

  const color = isAtLimit
    ? "fg.error"
    : isNearLimit
    ? "fg.warning"
    : "fg.muted";

  return (
    <>
      <VisuallyHidden id={descriptionId}>
        Up to {maxLength} characters
      </VisuallyHidden>
      <VisuallyHidden aria-live="polite">{announcement}</VisuallyHidden>
      {length > 0 && (
        <Text
          aria-hidden="true"
          as="span"
          {...(className ? { className } : {})}
          fontSize="sm"
          color={color}
          fontWeight={isNearLimit ? "semibold" : "normal"}
          whiteSpace="nowrap"
          fontVariantNumeric="tabular-nums"
        >
          {length} / {maxLength}
        </Text>
      )}
    </>
  );
}

function describeRemaining(remaining: number): string {
  if (remaining <= 0) {
    return "Character limit reached";
  }
  if (remaining === 1) {
    return "1 character left";
  }
  return `${remaining} characters left`;
}

/** Returns `text` once it has stayed the same for `ANNOUNCE_DELAY_MS`. */
function useDelayedAnnouncement(text: string): string {
  const [announced, setAnnounced] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setAnnounced(text), ANNOUNCE_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [text]);

  return announced;
}
