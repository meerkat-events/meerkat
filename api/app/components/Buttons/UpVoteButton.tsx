import { IconButton } from "@chakra-ui/react";
import { FiChevronUp as TriangleUpIcon } from "react-icons/fi";

interface UpVoteButtonProps {
  hasVoted: boolean;
  isDisabled?: boolean;
  onClick: () => void;
}

export function UpVoteButton(
  { hasVoted, isDisabled, onClick }: UpVoteButtonProps,
) {
  const color = hasVoted ? "white" : "gray.300";

  return (
    <IconButton
      type="submit"
      disabled={isDisabled}
      variant="ghost"
      size="md"
      color={color}
      aria-label="Vote for this question"
      onClick={onClick}
    >
      <TriangleUpIcon />
    </IconButton>
  );
}
