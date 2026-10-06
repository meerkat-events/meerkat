import { Button, type ButtonProps } from "@chakra-ui/react";
import { LuArrowBigUp } from "react-icons/lu";

type UpVoteButtonProps = Omit<ButtonProps, "children"> & {
  votes: number;
  voted: boolean;
};

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
  borderColor: "brand.solid",
  color: "vote.fg",
  _hover: { bg: "vote.hover" },
} as const;

/** Vote pill: arrow and count in one tap target, filled once you've voted. */
export function UpVoteButton({ votes, voted, ...props }: UpVoteButtonProps) {
  return (
    <Button
      {...props}
      {...(voted ? votedStyles : notVotedStyles)}
      type="button"
      size="sm"
      borderRadius="full"
      paddingInline="3"
      gap="1.5"
      fontVariantNumeric="tabular-nums"
      aria-pressed={voted}
      aria-label={`Upvote, ${votes} ${votes === 1 ? "vote" : "votes"}`}
    >
      <LuArrowBigUp fill={voted ? "currentColor" : "none"} />
      {votes}
    </Button>
  );
}
