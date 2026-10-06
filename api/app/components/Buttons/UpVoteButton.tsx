import type { Ref } from "react";
import { Button, type ButtonProps } from "@chakra-ui/react";
import { LuArrowBigUp } from "react-icons/lu";
import { FiZap } from "react-icons/fi";

type UpVoteButtonProps = Omit<ButtonProps, "children"> & {
  votes: number;
  voted: boolean;
  /** The user spent a supervote here: gold ring and bolt. */
  supervoted?: boolean | undefined;
  ref?: Ref<HTMLButtonElement>;
};

// Light themes use the darker brand.800 so the count stays readable on white
// and on the filled pill; dark themes can use the brand color directly.
const votedStyles = {
  variant: "solid",
  bg: "brand.800",
  color: "brand.contrast",
  _hover: { bg: "brand.900" },
  _dark: { bg: "brand.solid" },
} as const;

const notVotedStyles = {
  variant: "outline",
  borderColor: "brand.solid",
  color: "brand.800",
  _hover: { bg: "brand.solid/10" },
  _dark: { color: "brand.300" },
} as const;

/** Vote pill: arrow and count in one tap target, filled once you've voted. */
export function UpVoteButton(
  { votes, voted, supervoted, ...props }: UpVoteButtonProps,
) {
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
