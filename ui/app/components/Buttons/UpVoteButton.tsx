import { IconButton } from "@chakra-ui/react";
import { TriangleUpIcon } from "@chakra-ui/icons";

interface UpVoteButtonProps {
  hasVoted: boolean;
  isDisabled?: boolean;
}

export function UpVoteButton({ hasVoted, isDisabled }: UpVoteButtonProps) {
  const color = hasVoted ? "white" : "#AFA5C0";

  return (
    <IconButton
      type="submit"
      isDisabled={isDisabled}
      variant="ghost"
      color={color}
      size="md"
      icon={<TriangleUpIcon />}
      aria-label="Vote for this question"
    />
  );
}
