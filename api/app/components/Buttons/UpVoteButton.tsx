import { Button, type ButtonProps } from "@chakra-ui/react";
import { LuArrowBigUp } from "react-icons/lu";
import { tapTargetStyles } from "../../theme/index.ts";
import { FiZap } from "react-icons/fi";

type UpVoteButtonProps = Omit<ButtonProps, "children"> & {
  votes: number;
  voted: boolean;
  /**
   * The user spent a supervote here: gold ring and bolt. Callers disable the
   * pill then (a supervote can't be un-voted); it keeps its full color.
   */
  supervoted?: boolean | undefined;
};

const supervotedStyles = {
  _disabled: { opacity: 1, cursor: "default" },
} as const;

// The vote.* colors come from the theme (theme/index.ts): by default the
// darker brand.800 on light themes, so the count stays readable on white and
// on the filled pill, and the brand color itself on dark themes.
const votedStyles = {
  variant: "solid",
  bg: "vote.solid",
  color: "brand.contrast",
  _hover: { bg: "vote.solidHover" },
} as const;

const notVotedStyles = {
  variant: "outline",
  borderColor: "vote.border",
  color: "vote.fg",
  _hover: { bg: "vote.hover" },
} as const;

/** Vote pill: arrow and count in one tap target, filled once you've voted. */
export function UpVoteButton(
  { votes, voted, supervoted, ...props }: UpVoteButtonProps,
) {
  return (
    <Button
      {...props}
      {...(voted ? votedStyles : notVotedStyles)}
      {...(supervoted ? supervotedStyles : {})}
      {...tapTargetStyles}
      type="button"
      size="sm"
      h="questionControl"
      borderRadius="full"
      // A count, not a label: not a theme's buttonFontWeight
      fontWeight="medium"
      paddingInline="3"
      gap="1.5"
      fontVariantNumeric="tabular-nums"
      className={supervoted ? "supervote-voted" : undefined}
      aria-pressed={voted}
      aria-label={`Upvote, ${votes} ${votes === 1 ? "vote" : "votes"}${
        supervoted ? ", supervoted" : ""
      }`}
    >
      {supervoted
        ? <FiZap color="#F6B613" fill="#F6B613" />
        : <LuArrowBigUp fill={voted ? "currentColor" : "none"} />}
      {votes}
    </Button>
  );
}
